---
layout: post
title: "OP_CHECKSIG beyond signature validation: covenants, transaction introspection and PUSHTX"
description: Constructing Bitcoin covenants and transaction introspection by using OP_CHECKSIG to build PUSHTX.
date: 2024-12-04
author: Federico Barbacovi
tags:
  - Bitcoin Script
  - Covenants
  - Transaction introspection
series: OP_CHECKSIG beyond signature validation
series_order: 1
katex: true
---

# What is this post about?

Bitcoin's architecture ensures that only the rightful owner of a satoshi can spend it. The conditions under which a satoshi can be spent are encoded into its locking script, and enforced by miners. It's clear that the most important check is to authenticate the rightful owner of the satoshi, but what if we want to impose other conditions?

Locking scripts that put restrictions on how a satoshi can be spent (or, more generally, on how the transaction spending the satoshis can be constructed) are called *covenants*, and are the focus of this post. For quite a while, it wasn't clear whether covenants could be constructed in Bitcoin without changing Bitcoin. However, it has been shown that they are indeed achievable.

The key is to use a special opcode: $\texttt{OP\\_CHECKSIG}$. Even though it was initially designed to verify signatures, it can be leveraged for other uses. In this blogpost and its companion (very soon to follow), we will show how to use $\texttt{OP\\_CHECKSIG}$ to achieve transaction introspection efficiently. In another (soon to follow) blogpost, we will instead show how $\texttt{OP\\_CHECKSIG}$ can be used to efficiently verify scalar point multiplications on the Bitcoin curve. Stay tuned for updates!

## A brief history of covenants in Bitcoin

Before delving into mathematical and implementation details, we survey the history of covenants in Bitcoin.

The idea of covenants first appeared in 2016 in [Enhancing Bitcoin Transactions with Covenants](https://fc17.ifca.ai/bitcoin/papers/bitcoin17-final28.pdf), written by R. O'Connor and M. Piekarska from Blockstream. They explained how to achieve transaction introspection by introducing a new opcode that verifies signatures on arbitrary messages. While the idea is interesting, there was no appetite to introduce a new opcode at the time.

Successively (2017), Y. Chan and D. Kramer at nChain came up with the idea of signing messages in Bitcoin Script (which does not require any new opcode), and turned this idea into a recipe to construct covenants. A few years later, sCrypt implemented this idea (you can find a blog post from sCrypt [here](https://scryptplatform.medium.com/op-push-tx-3d3d279174c1)).

In 2020, sCrypt came up with a way to [optimise the covenant construction](https://scryptplatform.medium.com/optimal-op-push-tx-ded54990c76f), which leveraged a new insight: the spender can tweak the transaction and put it into a specific form to simplify the signature generation. The optimised construction by sCrypt greatly reduced the script size required to implement a covenant.

Up until the blogpost [CAT and Schnorr Tricks I](https://medium.com/blockstream/cat-and-schnorr-tricks-i-faf1b59bd298) by A. Polestra from Blockstream in 2021, all the covenants constructions had been using ECDSA. In his blogpost, Polestra explains how to leverage Schnorr signatures (introduced in BTC with [BIP 340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki)) to construct covenants.

Since Polestra's blogpost, the interest in Bitcoin covenants has been renewed ([BIP 347](https://github.com/bitcoin/bips/blob/master/bip-0347.mediawiki), [Implementing a Bridge covenant on $\texttt{OP\\_CAT}$-enabled Bitcoin](https://starkware.co/blog/implementing-a-bridge-covenant-on-op-cat-bitcoin/)), and here we are today writing about them and their implementation.

## Why is this post so long?

Explaining what covenants are is simple, constructing them is harder. We must understand a bit of math, and part of the Bitcoin's node software. That's why the post is long: it contains a blend of math and code. On the flip side, everything is now in one place and can be searched with ease!

To maintain a certain flow, we decided to go straight into math and implementation, without presenting all the required definitions. If you are accustomed to elliptic curves and Bitcoin, you can jump right in! If you're not, do not despair. We provide all the necessary details (and links to further resources) [here]({{ '/2024/12/04/what-is-that-notation.html' | relative_url }}). Feel free to have a look every time there's a notion you want to brush up on.

# <a id="tx-introspection">Transaction introspection</a>

For a long time, [locking scripts](#tx-introspection) were used to determine *who* could spend a UTXO but not *how* the UTXO could be spent. In other words, there was an abundance of UTXOs that could only be spent by Alice but none that could only be spent by Alice to pay Bob.

The situation has recently changed, and there is now a strong interest in the Bitcoin community for locking scripts that can enforce conditions on the spending of the UTXO, which we call *covenants*. This requires the ability of *transaction introspection*, namely, the locking script must be able to access the transaction in which the UTXO is being spent. The question is, how can this capability be achieved?

## The goal

What does it mean that the locking script $\mathsf{lock}$ of $\mathsf{UTXO}$ achieves transaction introspection? It means that at some point during its execution, $\mathsf{lock}$ knows that it is parsing the transaction $\mathsf{tx}$ that spends $\mathsf{UTXO}$, also called the *spending transaction*. As the data on which $\mathsf{lock}$ is executed is passed via the unlocking script $\mathsf{unlock}$, transaction introspection means forcing $\mathsf{unlock}$ to contain $\mathsf{tx}$.

Trimming it to the bare minimum, we want to construct $\mathsf{lock}$ such that on input $\mathsf{unlock}= \texttt{<}m' \texttt{>}$ it returns $(m' \overset{?}{=} \mathsf{tx})$, where $\mathsf{tx}$ is the spending transaction.[^1]

## Why so challenging?

Why it was not clear that transaction introspection could be achieved is that $\mathsf{lock}$ is executed *only* on the input data $\mathsf{unlock}$. This means that $\mathsf{lock}$ cannot access any information that can be used to validate whether $m'$ is $\mathsf{tx}$ or not.

If this last statement were correct, transaction introspection could not be achieved. Fortunately, there is one opcode that can access data outside the one provided by $\mathsf{unlock}$: $\texttt{OP\\_CHECKSIG}$. At first, it is not clear why $\texttt{OP\\_CHECKSIG}$ should help us to achieve our goal: this opcode is used to verify signatures, it does not push transaction data to the stack. The point is that $\texttt{OP\\_CHECKSIG}$ can be used as a source of truth against which we can compare $m'$.

## $\texttt{OP\\_CHECKSIG}$

How does $\texttt{OP\\_CHECKSIG}$ work? It takes in a Bitcoin public key and a signature, and verifies the validity of the signature against (a message digest of) the transaction. Let's spell this out in detail.

Assume Bob holds a private-public key pair $(sk_B, pk_B)$ for [$\mathsf{secp256k1}$](https://en.bitcoin.it/wiki/Secp256k1). If

$$
\mathsf{UTXO}.\mathsf{lock}= \texttt{<}pk_B \texttt{>}\; \texttt{OP\_CHECKSIG}
$$

 and[^2] the input of $\mathsf{tx}$ at index $\mathsf{ix}$ is $\mathsf{UTXO}$, i.e., $\mathsf{tx}\mathsf{.in}[\mathsf{ix}] = \mathsf{UTXO}$, then

$$
\mathsf{ECDSAb}\mathsf{.verify}(sig_B, \mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{b}), pk_B) \leftarrow \texttt{<}sig_B \texttt{>}\; \texttt{<}pk_B \texttt{>}\; \texttt{OP\_CHECKSIG}
$$

 where [$\mathsf{ECDSAb}$]({{ '/2024/12/04/what-is-that-notation.html' | relative_url }}#ecdsa) is the version of ECDSA used in Bitcoin, $\mathsf{PreSigHash}$ is the [message digest algorithm]({{ '/2024/12/04/what-is-that-notation.html' | relative_url }}#message-digest-alg), and $\mathsf{b}$ is the [SIGHASH flag](https://wiki.bitcoinsv.io/index.php/SIGHASH_flags).

Something striking happens here: $\texttt{OP\\_CHECKSIG}$ returns the validity of $sig_B$ for the message $\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{b})$ and the public key $pk_B$, but it is not supplied $\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{b})$ from the script! It means that $\texttt{OP\\_CHECKSIG}$ is accessing data outside of the unlocking script, and this opens up the possibility of transaction introspection.

## From $\texttt{OP\\_CHECKSIG}$ to transaction introspection

Let's take a step back, and reflect on what conclusions can be drawn from a valid signature $sig_B$ by Bob on message $m$. If $sig_B$ is valid for $pk_B$ on message $m$, it means that Bob signed with his private key $sk_B$, and that he signed $m$.

Assume we knew $sk_B$, and that we had access to $\mathsf{ECDSAb}\mathsf{.verify}(-,m,pk_B)$, where $-$ means we consider the first entry a free variable we can supply to the algorithm. Can we come up with a way to validate whether an input $m'$ is equal to $m$? Yes, we can! The algorithm is the following:

$$
\begin{array}{ll}
        \textbf{Input:} & m'\\
        \textbf{Output:} & (m' \overset{?}{=} m)\\
        \textbf{Algorithm:} & \\
        \quad \quad 1. \; sig \leftarrow \mathsf{ECDSAb}\mathsf{.sign}(m',sk_B)\\
        \quad \quad 2. \; \mathsf{ECDSAb}\mathsf{.verify}\left( sig, m, pk_B \right)
    \end{array}
    $$

 With high probability, $m' = m$ if and only if the result is $1$ (see [Are we sure covenants are secure?](#security-of-pushtx)).

In our setup, we have $m = \mathsf{PreSigHash}(\mathsf{tx}, \mathsf{ix}, \mathsf{ALL})$, but what about $sk_B$? Note that Bob does not play any role in what we have described! What we needed was the ability to verify a signature on a given message with respect to a fixed public key. We are free to choose the public key, so we fix $sk_B = 1$ and $pk_B = G$ (the generator of $\mathsf{secp256k1}$).

The question now is, can we turn the above algorithm into a locking script $\mathsf{lock}$? If we could, then $\mathsf{lock}$ would achieve transaction introspection. What we need to do in Bitcoin Script is:

1.  Compute $\mathsf{ECDSAb}\mathsf{.sign}(m',1)$ starting from $m'$.
2.  Access $\mathsf{ECDSAb}\mathsf{.verify}(-,\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL}),G)$

The great news is that we can perform both step 1 and step 2! We explained that

$$
\mathsf{ECDSAb}\mathsf{.verify}(-,\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL}),G) = \texttt{<->} \; \texttt{<}G \texttt{>}\; \texttt{OP\_CHECKSIG}
$$

 and thus step 2 can be turned into Bitcoin Script. [Below](#from-m-to-sig) we explain how to compute $\mathsf{ECDSAb}\mathsf{.sign}(m',1)$ in Script.

We have covered all the ideas required to construct a locking script that achieves transaction introspection. Let's dive into the implementation of these ideas!

# PUSHTX

Let's give a name to the locking script that achieves transaction introspection: we call it PUSHTX, and we write $\texttt{[PUSHTX]}$ for its code implementation. This locking script works as follows:

$$
(m' \overset{?}{=} \mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL})) \leftarrow \texttt{<m'>} \; \texttt{[PUSHTX]}
$$

 where $\mathsf{tx}\mathsf{.in}[\mathsf{ix}]$ spends the UTXO locked with $\texttt{[PUSHTX]}$, and $m'$ is part of $\mathsf{tx}\mathsf{.in}[\mathsf{ix}]\mathsf{.unlock}$. [We explained](#tx-introspection) how $\texttt{[PUSHTX]}$ can be achieved. We now delve into its implementation.

## <a id="from-m-to-sig">Computing $\mathsf{ECDSAb}\mathsf{.sign}(m',1)$ in Bitcoin Script</a>

The first step in implementing $\texttt{[PUSHTX]}$ is computing $\mathsf{ECDSAb}\mathsf{.sign}(m',1)$ given $m'$. If we look at the definition of [$\mathsf{ECDSAb}\mathsf{.sign}$]({{ '/2024/12/04/what-is-that-notation.html' | relative_url }}#ecdsa), we see that we should sample a random $k$ from $\mathbb{F}_{n}^{\ast}$, where $n$ is the order of $\mathsf{secp256k1}$. As we do not need to keep $k$ private, we can choose any value for it, and we fix it to be $k = 1$. Then,

$$
(r,s) \leftarrow \mathsf{ECDSAb}\mathsf{.sign}(m',1)
$$

 is given by

$$
r = G_x \quad \quad s = \min \{ \mathsf{HASH256}(m') + G_x, n - (\mathsf{HASH256}(m') + G_x)\} \mod n
$$

 We can hard-code $r$ in $\texttt{[PUSHTX]}$, while $s$ can be computed on-chain. Unfortunately, its computation is slightly more involved than what it looks like.

We would to expect the following script to compute $\mathsf{HASH256}(m') + G_x \mod n$:

$$
\texttt{<}\mathsf{HASH256}(m') + G_x \mod n \texttt{>}\leftarrow \texttt{<}m \texttt{>}\; \texttt{OP\_HASH256}\; \texttt{<}G_x \texttt{>}\; \texttt{OP\_ADD}\; \texttt{<}n \texttt{>}\; \texttt{OP\_MOD}
$$

 However, this is not the case, and the problem is something called *endianness*. In a nutshell, when Bitcoin Script interprets an element for the purpose of mathematical operations, it reads it right to left, whereas when it parses it for any other reason (e.g., hashing), it reads it left to right. This means that after hashing $m'$, we need to reverse the order of its bytes.

We write a script $\texttt{[REVERSE\\_ENDIANNESS]}$ that performs this reversal. You can find the full code generating this script [here](https://github.com/nchain-innovation/zkscript_package/blob/0be3b97cc34ec35a60e4172eebf0bc7ac432a17d/src/zkscript/util/utility_scripts.py#L309), we limit ourselves to a pseudocode description:

```python
def reverse_endianness(length: int) -> Script:
    out = ""
    out += " ".join(["OP_1 OP_SPLIT"] * (length-1))
    out += " ".join(["OP_SWAP OP_CAT"] * (length-1))
    return out
```

Anyhow, using $\texttt{[REVERSE\\_ENDIANNESS]}$ and other opcodes, we can construct a script $\texttt{[GENERATE\\_SIG]}$ that on input $m'$, returns $r$ and $s$:

$$
\texttt{<}r \texttt{>}\; \texttt{<}s \texttt{>}\leftarrow \texttt{<}m' \texttt{>}\; \texttt{[GENERATE\_SIG]}
$$

 Unfortunately, at this point we stumble onto the same problem once again. Signatures in Bitcoin are serialised according to [DER](https://github.com/bitcoin-sv/bitcoin-sv/blob/86eb5e8bdf5573c3cd844a1d81bd4fb151b909e0/src/script/interpreter.cpp#L164) format, and interpreted reading left to right. Hence, we must reverse the order of the bytes of $r$ and $s$.

This further endianness reversal completes the computation of the signature $\mathsf{ECDSAb}\mathsf{.sign}(m',1)$. We write $\texttt{[MESSAGE\\_TO\\_SIG]}$ for the script performing this computation:

$$
\texttt{<}\texttt{DER}(r,s) \texttt{>}\leftarrow \texttt{<}m' \texttt{>}\; \texttt{[MESSAGE\_TO\_SIG]}
$$

## The final step

Now that we have $\texttt{[MESSAGE\\_TO\\_SIG]}$ at our disposal, we can complete the implementation of $\texttt{[PUSHTX]}$. The final step is simple: leverage $\texttt{OP\\_CHECKSIG}$ to verify the validity of the signature we constructed:

$$
\texttt{[PUSHTX]}:= \texttt{[MESSAGE\_TO\_SIG]}\; \texttt{<}G_x \texttt{>}\; \texttt{OP\_CHECKSIG}
$$

 and then

$$
(m' \overset{?}{=} \mathsf{PreSigHash}(\mathsf{tx}, \mathsf{ix}, \mathsf{ALL})) \leftarrow \texttt{<}m' \texttt{>}\; \texttt{[PUSHTX]}
$$

 You can find the implementation of $\texttt{[PUSHTX]}$ [here](https://github.com/nchain-innovation/zkscript_package/blob/0be3b97cc34ec35a60e4172eebf0bc7ac432a17d/src/zkscript/transaction_introspection/transaction_introspection.py#L39) and the opcodes that make up $\texttt{[PUSHTX]}$ [here](https://test.whatsonchain.com/tx/a626525eb792dc6d2ff51739b9be84288f46b37c6fa49970e44694c9ea0b8fc3?tab=scripts) (see also [On-chain deployment](#on-chain-deployment)).

What's the total script size, you asked? $\texttt{[PUSHTX]}$ requires $376$ bytes, the biggest overhead being due to the endianness reversals, which accounts for $228$ bytes.

The image below gives a visual breakdown of the code that makes up $\texttt{[PUSHTX]}$ (the image was generated with [Carbon](https://carbon.now.sh/))

![The flow of data through the PUSHTX construction]({{ '/assets/posts/pushtx/pushtx-logic.png' | relative_url }})

## Can we do better?

As always, when implementing an algorithm in Bitcoin Script we challenge ourselves to do better (in terms of script size) than what we have done. We did it when we implemented [Merkle trees]({{ '/2024/11/03/merkle-trees-in-bitcoin-script.html' | relative_url }}), and we do it now that we have implemented $\texttt{[PUSHTX]}$.

We believe this post is already long enough, so we delegate the answer to the question *can we do better?* to a companion post (soon to follow). Be sure to check it out! Spoiler alert, *we can do better!*

# On-chain deployment

We deployed $\texttt{[PUSHTX]}$ on-chain. We locked the output of [tx/a626..8fc3](https://test.whatsonchain.com/tx/a626525eb792dc6d2ff51739b9be84288f46b37c6fa49970e44694c9ea0b8fc3) with a locking script that allows spending only if the version number of the spending transaction is $\texttt{0x24201118}$ (the date of the day in which we created and spent the UTXO, written in little endian). We spent this UTXO at [tx/3c4d..0777](https://test.whatsonchain.com/tx/3c4dd601f82d9ed1b3cd6491cfbf3bf07f1b3340545d7bf26dcf9ce5e13c0777).

Thanks to the modular structure of [zkscript](https://github.com/nchain-innovation/zkscript_package), constructing the locking script is very easy:

```python
from tx_engine import Script, SIGHASH
from src.zkscript.transaction_introspection.transaction_introspection import (
    TransactionIntrospection
)

locking_script_fixed_tx_version = TransactionIntrospection.pushtx(
    sighash_value=SIGHASH.ALL_FORKID,
    rolling_option=False
)
locking_script_fixed_tx_version += Script.parse_string(
    "OP_4 OP_SPLIT OP_DROP"
    ) # Get tx.version
locking_script_fixed_tx_version.append_pushdata(
    bytes.fromhex("18112024")
    )
locking_script_fixed_tx_version += Script.parse_string(
    "OP_EQUAL"
    ) # Enforce tx.version = 0x18112024
```

# <a id="security-of-pushtx">Are we sure covenants are secure?</a>

The reason why $\texttt{[PUSHTX]}$ is secure is at it leverages $\mathsf{ECDSAb}$, which is known to be secure under the assumption that $\mathsf{HASH256}$ is a [one way](https://en.wikipedia.org/wiki/One-way_function), [collision resistant hash function](https://en.wikipedia.org/wiki/Cryptographic_hash_function) (and that discrete logarithms are hard in $\mathsf{secp256k1}$).

As $k = sk = 1$ are fixed in $\texttt{[PUSHTX]}$, the only way an attacker can trick $\texttt{[PUSHTX]}$ is by finding $m'$ such that $m' \neq \mathsf{PreSigHash}(\mathsf{tx}, \mathsf{ix}, \mathsf{ALL})$ and

$$
\mathsf{ECDSAb}\mathsf{.sign}(m',1) = \mathsf{ECDSAb}\mathsf{.sign}(\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL}),1) \mod n
$$

 By the definition of the signature algorithm, this means that the attacker has found $m' \neq \mathsf{PreSigHash}(\mathsf{tx}, \mathsf{ix}, \mathsf{ALL})$ such that

$$
\mathsf{HASH256}(m') = \pm \mathsf{HASH256}(\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL})) \mod n
$$

 If such an attacker $\mathcal{A}$ existed, we could break collision resistance of $\mathsf{HASH256}$ as follows:

-   Select a random transaction $\mathsf{tx}$ and a random index $\mathsf{ix}\leq n_{in} - 1$
-   Run the attacker 5 times on input $\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL})$ and denote $m_i'$ the output of the $i$-th execution
-   If:
    1.  For one the attempts we have

        $$
        \mathsf{HASH256}(m') = \mathsf{HASH256}(\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL}))
        $$

        return $m', \mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL})$
    2.  If there are two attempts such that $\mathsf{HASH256}(m_i') = \mathsf{HASH256}(m_j')$ with $i \neq j$, return $m_i', m_j'$

Write $\mathcal{A}'$ for the algorithm described above. Then $\mathcal{A}'$ succeeds in breaking collision resistance of $\mathsf{HASH256}$ with probability bigger or equal than the probability that $\mathcal{A}$ succeeds five times in a row (up to a negligible difference). Indeed, if $\mathcal{A}$ succeeds five times in a row, then either case 1 happens, or case 2 happens by the [pigeonhole principle](https://en.wikipedia.org/wiki/Pigeonhole_principle). In both cases, we break collision resistance.[^3]

[^1]: In reality, we will check that $m'$ is equal to the message digest of $\mathsf{tx}$. Keep reading to know more!

[^2]: For the notation we use to denote the elements of a Bitcoin transactions, see [here]({{ '/2024/12/04/what-is-that-notation.html' | relative_url }}#txs).

[^3]: The probability of success of $\mathcal{A}'$ is slightly less than the probability of $\mathcal{A}$ succeeding five times in a row because it could happen that $m_i' = m_j'$, but as $\mathsf{HASH256}$ compresses its inputs, this probability is very low, see [this](https://www.cs.ucdavis.edu/~rogaway/papers/relates.pdf) paper by Rogaway and Shrimpton.

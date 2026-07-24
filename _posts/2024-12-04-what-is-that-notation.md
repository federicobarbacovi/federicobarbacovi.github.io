---
layout: post
title: Notation references
description: A reference for the ECDSA, Bitcoin transaction, and message-digest notation used throughout the technical posts.
date: 2024-12-04
author: Federico Barbacovi
tags:
  - Reference
  - ECDSA
  - Bitcoin
katex: true
---

The purpose of this post is to be a reference for other ones. Below we detail some of the notation we use in other posts, together with links to online resources that provide further details and explanations.

# ECDSA {#ecdsa}

Bitcoin signatures are generated using the [Elliptic Curve Digital Signature Algorithm](https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm). ECDSA is an algorithm with which Bob can sign a message $m$ so that Alice can verify that $m$ was signed by Bob, and that Bob was the person who signed $m$.

Bob needs a private-public key pair, where the public key is a point $pk\_B$ on an elliptic curve $E$, and the private key $sk\_B$ is the discrete logarithm of the public key with respect to a fixed generator $G \in E$:

$$
pk_B = sk_B \cdot G
$$

 Furthermore, Alice and Bob must agree on a [hash function](https://en.wikipedia.org/wiki/Cryptographic_hash_function) $\mathsf{H}$.

In Bitcoin, the curve is [$\mathsf{secp256k1}$](https://en.bitcoin.it/wiki/Secp256k1). Bob then holds a private-public key pair $(sk\_B, pk\_B)$, where $sk\_B \in$ [$\mathbb{F}\_{n}$](https://en.wikipedia.org/wiki/Finite_field), with $n$ the order of $\mathsf{secp256k1}$, and $pk\_B = sk\_B \cdot G$. The hash function is $\mathsf{HASH256}=$ [$\mathsf{SHA256}$](https://en.wikipedia.org/wiki/SHA-2) $\circ \, \mathsf{SHA256}$.

**Definition**. For a message $m$, the signature of $m$ with respect to $(sk\_B,pk\_B)$ is $sig := (r,s) \leftarrow \mathsf{ECDSAb}\mathsf{.sign}(sk\_B,m)$, and it is computed as follows:

1.  While $r = 0 \mod n$, sample $k \leftarrow \mathbb{F}\_{n}^{\ast}$ at random and set $R := kG$, $r := R\_x$.
2.  Compute $s' := k^{-1} ( \mathsf{HASH256}(m) + sk\_B \cdot r) \mod n$. If $s = 0 \mod n$, restart.
3.  <a id="min-step-sign">Set</a> $s := min \{ s', n - s'\} \mod n$

To verify $sig = (r,s)$, the following algorithm is executed:

1.  <a id="min-step-verify">Assert</a> $2s < n$.
2.  Compute $Q = s^{-1} ( \mathsf{HASH256}(m) \cdot G + r \cdot pk\_B)$
3.  If $Q$ is the point at infinity, fail.
4.  Output $\mathsf{ECDSAb}\mathsf{.verify}(sig,m,pk\_B) := (Q\_x \overset{?}{=} r \mod n)$

The algorithm $\mathsf{ECDSAb}$ is used in Bitcoin to verify digital signatures. To be precise, the form of $\mathsf{ECDSAb}$ we described above is used in a version of Bitcoin called BSV. Other versions of Bitcoin skip [step 3](#min-step-sign) in the signature algorithm, and [step 1](#min-step-verify) in the verification algorithm.

## Transactions {#txs}

Transactions in Bitcoin are made of inputs: $\mathsf{TXIN}$s, outputs $\mathsf{TXO}$s, and some additional data. In some sense, outputs come before inputs in Bitcoin, as an input is a reference to an unspent output: $\mathsf{UTXO}$.

We write $\mathsf{tx}$ for a [transaction](https://wiki.bitcoinsv.io/index.php/Bitcoin_Transactions), and we write:
-   $\mathsf{tx}\mathsf{.version}$ for the $4$ bytes version of the transaction
-   $\mathsf{tx}\mathsf{.in}$ for the list of inputs $\mathsf{TXIN}$s
-   $\mathsf{tx}\mathsf{.out}$ for the list of outputs $\mathsf{TXO}$s (which are also $\mathsf{UTXO}$s until they are spent)
-   $\mathsf{tx}\mathsf{.locktime}$ for $4$ bytes locktime of the transaction

We use Python-style indexing for lists, so that if $n\_{in}$ is the number of inputs of $\mathsf{tx}$, and $\mathsf{ix}\in \{0, \dots, n\_{in}-1\}$, then $\mathsf{tx}\mathsf{.in}[\mathsf{ix}]$ denotes the input at index $\mathsf{ix}$. A similar remark applies for outputs.

An output $\mathsf{TXO}$ has the following fields:

-   $\mathsf{TXO}.\mathsf{amount}$ the amount of satoshis held by $\mathsf{TXO}$, expressed as an $8$ byte number
-   $\mathsf{TXO}.\mathsf{lock}$ the locking script of the output

while an input $\mathsf{TXIN}$ has the following fields:

-   $\mathsf{TXIN}.\mathsf{prevtx}$ the $32$ bytes identifier (the *transaction id*) of the transaction in which the UTXO being spent was created
-   $\mathsf{TXIN}.\mathsf{previx}$ the index, expressed as a $4$ bytes number, identifying the $\mathsf{UTXO}$ being spent among the ones of $\mathsf{TXIN}.\mathsf{prevtx}$
-   $\mathsf{TXIN}.\mathsf{unlock}$ the unlocking script of the input
-   $\mathsf{TXIN}.\mathsf{sequence}$ the sequence number of the input

We refer to the couple $(\mathsf{TXIN}.\mathsf{prevtx}, \mathsf{TXIN}.\mathsf{previx})$ as an outpoint, as it uniquely specifies the $\mathsf{UTXO}$ begin spent.

The [*transaction id*](https://wiki.bitcoinsv.io/index.php/TXID) of $\mathsf{tx}$ is defined as

$$
\mathsf{txid}(\mathsf{tx}) := \mathsf{HASH256}(\mathsf{tx}.\mathsf{serialise}())
$$

 where we write $\mathsf{tx}.\mathsf{serialise}()$ for the serialisation of all the fields that make up the transaction.

## Message digest algorithm {#message-digest-alg}

Before signing a transaction $\mathsf{tx}$, the user Bob passes it through a [digest algorithm](https://github.com/bitcoin-sv/bitcoin-sv/blob/master/doc/abc/replay-protected-sighash.md#digest-algorithm) that standardises the message that is going to be signed. The digest algorithm takes as input the transaction $\mathsf{tx}$, the position $\mathsf{ix}$ of the input Bob is signing for, and a flag $\mathsf{b}$ that decides which parts of the transaction are to be signed.

We write $\mathsf{PreSigHash}$ for the message digest algorithm, and we focus on the case $\mathsf{b}= \mathsf{ALL}$, which means Bob is signing the whole transaction (for other flags, see [here](https://github.com/bitcoin-sv/bitcoin-sv/blob/master/doc/abc/replay-protected-sighash.md#digest-algorithm)).

Let us write $(\mathsf{prevtx}, \mathsf{previx})$ for the $\mathsf{UTXO}$ being spent by Bob's input, and $n\_{in}$, $n\_{out}$ for the number of inputs and outputs, respectively, of the transaction $\mathsf{tx}$. Then, $\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL})$ is defined as the concatenation of the following fields:

-   $\mathsf{tx}\mathsf{.version}$
-   $\mathsf{hashPrevOut}$
-   $\mathsf{hashSequence}$
-   $\mathsf{txid}(\mathsf{prevtx}) \vert\vert\mathsf{previx}\vert\vert\mathsf{prevtx}.\mathsf{lock}\vert\vert\mathsf{prevtx}.\mathsf{amount}\vert\vert\mathsf{tx}\mathsf{.in}[\mathsf{ix}].\mathsf{sequence}$
-   $\mathsf{hashOutputs}$
-   $\mathsf{tx}\mathsf{.locktime}$
-   $\mathsf{0x41000000}$ (byte representation of $\mathsf{ALL}$)

where

$$
\begin{array}{lcl}
        \mathsf{hashPrevOut} &= &\mathsf{HASH256}(\mathsf{tx}\mathsf{.in}[0].\mathsf{prevtx}\vert\vert\mathsf{tx}\mathsf{.in}[0].\mathsf{previx}\vert\vert\dots \\
        {} & {} &\quad\quad\quad\quad\quad\quad \dots \vert\vert\mathsf{tx}\mathsf{.in}[n_{in}-1].\mathsf{prevtx}\vert\vert\mathsf{tx}\mathsf{.in}[n_{in}-1].\mathsf{previx})\\
        \mathsf{hashSequence} &= &\mathsf{HASH256}(\mathsf{tx}\mathsf{.in}[0].\mathsf{sequence}\vert\vert\dots \vert\vert\mathsf{tx}\mathsf{.in}[n_{in}-1].\mathsf{sequence})\\
        \mathsf{hashOutputs} &= &\mathsf{HASH256}(\mathsf{tx}\mathsf{.out}[0].\mathsf{amount}\vert\vert\mathsf{tx}\mathsf{.out}[0].\mathsf{lock}\vert\vert\dots \\
        {} & {} &\quad\quad\quad\quad\quad\quad \dots \vert\vert\mathsf{tx}\mathsf{.out}[n_{out}-1].\mathsf{amount}\vert\vert\mathsf{tx}\mathsf{.out}[n_{out}-1].\mathsf{lock})
    \end{array}
    $$

---
layout: post
title: "OP_CHECKSIG beyond signature validation: a more efficient PUSHTX"
description: Reducing the PUSHTX Bitcoin Script construction from 376 bytes to 82 bytes using bit shifts.
date: 2025-01-03
author: Federico Barbacovi
tags:
  - Bitcoin Script
  - Covenants
  - Performance
series: OP_CHECKSIG beyond signature validation
series_order: 2
katex: true
---

# Covenants, again?

In [OP_CHECKSIG beyond transaction validation: transaction introspection]({{ '/2024/12/04/covenants-transaction-introspection-pushtx.html' | relative_url }}), we explained how to construct[^1] [$\texttt{[PUSHTX]}$](https://github.com/nchain-innovation/zkscript_package/blob/8d433120bf7fbe4a6a44e7e8e36bb2cf4a9807a1/src/zkscript/transaction_introspection/transaction_introspection.py#L39), a locking script that achieves transaction introspection. In the same post, we asked ourselves: can we do better in terms of script size? $\texttt{[PUSHTX]}$ is $376$ bytes, can we decrease its size?

The aim of this post is to show that yes, it is not only possible to reduce the size of $\texttt{[PUSHTX]}$, we can achieve a script size equal to (one byte more than) our estimate for the *smallest possible script size* for $\texttt{[PUSHTX]}$!

# A ballpark estimate

The technique we use to achieve transaction introspection is to construct an [ECDSA](https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm) signature in Bitcoin Script, and then to verify the signature using $\texttt{OP\\_CHECKSIG}$. The ephemeral key $k$ used to generate the signature and the public key $sk$ used for verification are fixed in the locking script to ensure the locking script is secure.

As $k$ and $sk$ are fixed in the locking script, we must hard-code both $r = (kG)_x$ and $pk = sk \cdot G$. The byte size of $sk$ is $33$ bytes in compressed form, while the byte size of $r$ can be anything from $1$ to $33$ bytes.[^2] With high probability,[^3] the $32$nd byte of $r$ is non-zero for a random $k$, so our best hope is that $r$ fits in $32$ bytes (the $32$nd byte of $r$ is less than $\texttt{0x80}$).

When we constructed [$\texttt{[PUSHTX]}$](https://github.com/nchain-innovation/zkscript_package/blob/8d433120bf7fbe4a6a44e7e8e36bb2cf4a9807a1/src/zkscript/transaction_introspection/transaction_introspection.py#L39) we took $k = sk = 1$, which allowed us to reduce the amount of hard-coded data (as $pk = kG$) but required [endianness reversal](https://github.com/nchain-innovation/zkscript_package/blob/bb4fb376e626e97dfa42092da9ec19da728d6a23/src/zkscript/util/utility_scripts.py#L341). We don't see a way to avoid this overhead when $k = sk$, so let's focus on the case $k \neq sk$.

If $k \neq sk$, then we need to hard-code both $r$ and $pk$, which amount to $33 + 32 = 65$ bytes, plus two bytes for their length, for a total of $67$ bytes. However, as $k \neq sk$ in the [signature equation]({{ '/2024/12/04/what-is-that-notation.html' | relative_url }}#ecdsa)

$$
k^{-1} (\mathsf{HASH256}(m) + sk \cdot r) = k^{-1} \mathsf{HASH256}(m) + k^{-1} \cdot sk \cdot r
$$

 we have two degrees of freedom, and we [will](#pushtxbit-sec) see this is enough to avoid mathematical opcodes!

Let us compute a ballpark estimate for the smallest possible script size when $k \neq sk$. On top of hard-coding $r$ and $pk$, we need to:

-   compute the signature, which we estimate to take at least $2$ bytes (one input data, one operation)
-   construct the DER-encoding of the signature, which means prepending $r$ with $\texttt{0x30440220}$, $s$ with $\texttt{0x0220}$, and concatenating everything, accounting for $7$ ($6$ of pushdata, $1$ of concatenation) bytes
-   append the sighash flag at the end of the DER-encoded signature, accounting for $3$ bytes ($2$ to push, $1$ to concatenate)
-   hash the message and execute $\texttt{OP\\_CHECKSIG}$, accounting for $2$ bytes

In conclusion, the minimal size of a $\texttt{[PUSHTX]}$ script with $k \neq sk$ is:

$$
67 + 2 + 7 + 3 + 2 = 81
$$

 Below, we describe how to construct $\texttt{[PUSHTX\\_BIT\\_SHIFT]}$, a locking script that achieves transaction introspection in $82$ bytes!

## <a id="pushtxbit-sec">$\texttt{[PUSHTX\\_BIT\\_SHIFT]}$</a>

There are two reasons why the size of $\texttt{[PUSHTX]}$ is so big: endianness reversals, and hard-coded constants. To reduce the size of $\texttt{[PUSHTX]}$, we need to address these two problems. It turns out that addressing the first one solves the second one as well, so we focus on the former problem.

Endianness reversals arise because we need to switch between hashes and signatures, and numbers. If we could perform mathematics on $\mathsf{HASH256}(m')$ (without reversing its endianness), we could shave off $200$ bytes from $\texttt{[PUSHTX]}$. Among the opcodes, we find one that comes to our help: $\texttt{OP\\_RSHIFT}$.

$\texttt{OP\\_RSHIFT}$ right-shifts a byte sequence according to an input parameter:

$$
(m \; \texttt{>}\texttt{>}\; d) \leftarrow \texttt{<}m \texttt{>}\; \texttt{<}d \texttt{>}\; \texttt{OP\_RSHIFT}
$$

 For example: $\texttt{<}3 \texttt{>}\leftarrow \texttt{<}7 \texttt{>}\; \texttt{<}1 \texttt{>}\; \texttt{OP\\_RSHIFT}$, because: $7 = 111_2$ and therefore

$$
111_2 \; \texttt{>}\texttt{>}\; 1 = 11_2 = 3
$$

 The point is that right bit-shifting by $d$ bits has a mathematical interpretation: it means returning the quotient of the division of $m$ by $2^d$. In other words, we are performing a mathematical operation on $m$ without reversing its endianness!

To leverage $\texttt{OP\\_RSHIFT}$ for $\texttt{[PUSHTX]}$, we need to take a look at the signature construction in [$\mathsf{ECDSAb}$]({{ '/2024/12/04/what-is-that-notation.html' | relative_url }}#ecdsa). For a private key $sk$, a message $m'$, and an ephemeral key $k$, the $s$-component of the signature is:

$$
\min \{ k^{-1} (\mathsf{HASH256}(m') + sk \cdot r), n - k^{-1} (\mathsf{HASH256}(m') + sk \cdot r) \} \mod n
$$

 Now, if $k = 2^d$, $d > 0$, and $sk$ is such that $sk \cdot r = -1 \mod n$, the $s$-component becomes

$$
2^{-d} (\mathsf{HASH256}(m') - 1) \mod n
$$

 which looks very similar to a calculation we can perform with $\texttt{OP\\_RSHIFT}$: it's a division by $2^{-d}$ (up to subtracting $1$ from $\mathsf{HASH256}(m')$).

However, there's a catch. The calculation above is not really a division, it is multiplication by the inverse of $2^d$ in $\mathbb{F}\_{n}$. For example, if we were working with $\mathbb{F}\_{17}$, then

$$
2^{-1} = 9 \mod 17, \quad 2^{-1} \cdot 5 = 11 \mod 17
$$

 but $5 / 2$ is not $11$. The value $2^{-d}(\mathsf{HASH256}(m') - 1) \mod n$ is the quotient of the division of $(\mathsf{HASH256}(m') - 1)$ by $2^d$ only if the former is a multiple of $2^d$. Keeping on with our working example: $2^{-1} \cdot 4 = 2 \mod 17$.

It seems we are doomed: unless we are so lucky as to get

$$
2^d \mid \mathsf{HASH256}(m') - 1
$$

 then we cannot compute $2^{-d} (\mathsf{HASH256}(m') - 1) \mod n$ with $\texttt{OP\\_RSHIFT}$\... or can we?

In our case [$m' = \mathsf{PreSigHash}(\mathsf{tx}, \mathsf{ix}, \mathsf{ALL})$]({{ '/2024/12/04/what-is-that-notation.html' | relative_url }}#message-digest-alg), which is only *almost* fixed. The spending [transaction]({{ '/2024/12/04/what-is-that-notation.html' | relative_url }}#txs) can often be tweaked by changing the locktime, the sequence number of the inputs, or some other field (but not the unlocking script, as that doesn't affect $\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL})$). Therefore, we can require the spender to tweak the transaction until

$$
2^d \mid \mathsf{HASH256}(\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL})) - 1
$$

 so that the multiplication in the calculation of the signature *is* a division by $2^d$. Then, $s = 2^{-d} (\mathsf{HASH256}(\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL})) - 1) \mod n$ is equal to

$$
\texttt{<}\mathsf{HASH256}(\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL})) \texttt{>}\; \texttt{<}d \texttt{>}\; \texttt{OP\_RSHIFT}
$$

 which can be computed without any endianness reversal!

*Remark*. Note that the objective of the tweaking is to find a transaction $\mathsf{tx}$ such that

$$
\mathsf{HASH256}(\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL})) = 1 \mod 2^d
$$

 which happens once every $2^d$ transactions. Hence, the smaller $d$ is, the faster it is to find a valid transaction $\mathsf{tx}$. In the implementation, we take $d = 3$, so with roughly $8$ trials a correct transaction can be found.

Implementing this variation of $\texttt{[PUSHTX]}$ is quite easy, we only need to:

-   Fix $d$ (the smaller it is, the [higher the security of the script](#security-script)). We take[^4] $d=3$ as it produces the smallest script.[^5]
-   Find $sk$ such that $sk \cdot r = -1 \mod n$, where $r = (2^d \cdot G)_x$. Set $P = sk \cdot G$.
-   Implement the script as:[^6]

    $$
    \texttt{[PUSHTX\_BIT\_SHIFT]}= \texttt{OP\_HASH256} \; \texttt{<}d \texttt{>}\; \texttt{OP\_RSHIFT} \; \texttt{[..]} \; \texttt{<}P \texttt{>}\; \texttt{OP\_CHECKSIG}
    $$

 where $\texttt{[..]}$ turns $\texttt{<}s \texttt{>}$ into $\texttt{DER}(r,s)$.

You can find a full implementation of this variation of $\texttt{[PUSHTX]}$ [here](https://github.com/nchain-innovation/zkscript_package/blob/8d433120bf7fbe4a6a44e7e8e36bb2cf4a9807a1/src/zkscript/transaction_introspection/transaction_introspection.py#L136).

How much did we save? The script [$\texttt{[PUSHTX\\_BIT\\_SHIFT]}$](https://github.com/nchain-innovation/zkscript_package/blob/8d433120bf7fbe4a6a44e7e8e36bb2cf4a9807a1/src/zkscript/transaction_introspection/transaction_introspection.py#L136) is only $82$ bytes! We slashed the size of $\texttt{[PUSHTX]}$ by a factor of $4.5$, and almost achieved our ballpark estimate for the smallest possible script size! That's nice, isn't it?[^7]

Below you can find a visual breakdown (image generated with [Carbon](https://carbon.now.sh)) of the various parts that make up $\texttt{[PUSHTX\\_BIT\\_SHIFT]}$, and [here](https://test.whatsonchain.com/tx/dd99a45ba0aa6154260bbef3dd3ff7cbe4d1e2f6ad451d0085e6c2822585749d?tab=scripts) you can find the opcode representation. Enjoy!

![The streamlined PUSHTX bit-shift construction]({{ '/assets/posts/efficient-pushtx/bit-shift-logic.png' | relative_url }})

# On-chain deployment

We deployed the above scripts on-chain similarly to what we did for $\texttt{[PUSHTX]}$. We locked the output of [tx/dd99..749d](https://test.whatsonchain.com/tx/dd99a45ba0aa6154260bbef3dd3ff7cbe4d1e2f6ad451d0085e6c2822585749d) with a locking script that allows spending only if the version number of the spending transaction is $\texttt{0x24201118}$ (the date of the day in which we created and spent the UTXO, written in little endian). We spent this UTXO at [tx/6390..3d9f](https://test.whatsonchain.com/tx/6390f6e63b7c16bf8dd724237714d47c3a7e23017691968ef89fe2f5f6fe3d9f).

Thanks to the modular structure of [zkscript](https://github.com/nchain-innovation/zkscript_package), constructing the locking script is very easy:

```python
from tx_engine import Script, SIGHASH
from src.zkscript.transaction_introspection.transaction_introspection import (
    TransactionIntrospection
)

locking_script_fixed_tx_version = TransactionIntrospection.pushtx_bit_shift(
    sighash_value=SIGHASH.ALL_FORKID,
    rolling_option=False,
    security=3
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

# <a id="security-script">Is the script secure?</a>

As with every other script construction, we ask ourselves: is the script secure? In [Are we sure covenants are secure?]({{ '/2024/12/04/covenants-transaction-introspection-pushtx.html' | relative_url }}#security-of-pushtx) we explained why $\texttt{[PUSHTX]}$ is secure. The proof that $\texttt{[PUSHTX\\_BIT\\_SHIFT]}$ is secure works in a similar way, with the caveat that we need to run the adversary $\mathcal{A}$ that tricks $\texttt{[PUSHTX\\_BIT\\_SHIFT]}$ for $2^d \cdot 2 + 1$ times, because now $\mathcal{A}$ wins the game as long as it finds $m' \neq \mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL})$ such that

$$
\mathsf{HASH256}(m') = \mathsf{HASH256}(\mathsf{PreSigHash}(\mathsf{tx},\mathsf{ix},\mathsf{ALL})) - 1 + r_{m'} \mod n
$$

 where $0 \leq r_{m'} \leq 2^{d} -1$. The fact that we need to run the attacker more times means that we lose some bits of security, but as long as $2^d$ is small, we are fine.

[^1]: If you want to refresh the mathematical underpinning behind $\texttt{[PUSHTX]}$, pop over to the the above post before reading on.

[^2]: We are considering $r$ as an unsigned number.

[^3]: A byte is zero only if all its digits are zero, which happens with probability $1/256$. So the $32$nd byte is non-zero $255$ times out of $256$. Quite often!

[^4]: We do not consider $d=1$ because we deploy our scripts on BSV, which requires signatures to be smaller than $n / 2$. Taking $d=3$ ensures $s < n/2$, with $d = 1$ it could happen that $s \geq n/2$, and therefore the transaction would be rejected.

[^5]: $d = 2$ produces a script which is one byte longer as $r = (2^2 G)_x$ is $33$ byte long.

[^6]: Note that, as explained in the [documentation](https://github.com/nchain-innovation/zkscript_package/blob/8d433120bf7fbe4a6a44e7e8e36bb2cf4a9807a1/src/zkscript/transaction_introspection/transaction_introspection.py#L168) of the function generating the efficient version of pushtx, for the unlocking script to suceed, we need $\mathsf{PreSigHash} \geq 2^d \cdot 2^{31 \cdot 8}$. The reason for this is that $2^{31 \cdot 8}$ is the smallest number that is represented using $64$ bytes. If $\mathsf{PreSigHash}$ were smaller than $2^d \cdot 2^{31 \cdot 8}$, then $2^{-d} \cdot \mathsf{PreSigHash}$ would begin with $\texttt{00}$, and the signature would not have a valid DER encoding.

[^7]: Can't we get rid of that additional byte? Probably not. During script execution, two elements are on the stack in the wrong order, and to swap them we need $\texttt{OP\\_SWAP}$, which accounts for the additional byte.

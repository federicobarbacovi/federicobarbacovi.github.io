---
layout: post
title: "OP_CHECKSIG beyond signature validation: efficient operations on the Bitcoin curve"
description: Using OP_CHECKSIG to verify scalar multiplication and Pedersen commitments efficiently on secp256k1.
date: 2025-01-03
author: Federico Barbacovi
tags:
  - Bitcoin Script
  - Elliptic curves
  - Cryptography
series: OP_CHECKSIG beyond signature validation
series_order: 3
katex: true
---

# Welcome back!

Welcome back to the blogpost series: $\texttt{OP\\_CHECKSIG}$ beyond signature validation. In the previous blogposts [\[I\]]({{ '/2024/12/04/covenants-transaction-introspection-pushtx.html' | relative_url }}), [\[II\]]({{ '/2025/01/03/efficient-pushtx.html' | relative_url }}), we saw how to leverage $\texttt{OP\\_CHECKSIG}$ to achieve transaction introspection. In this blogpost, we'll use $\texttt{OP\\_CHECKSIG}$ to *efficiently* verify operations carried out on the Bitcoin curve [$\mathsf{secp256k1}$](https://en.bitcoin.it/wiki/Secp256k1).

Why should we do that, you may ask? Two reasons: it's fun (which is always a good reason for taking up a project), and it serves as a building block for EC-based (ZK) cryptographic schemes such as [Bulletproof](https://eprint.iacr.org/2017/1066.pdf).

Some acknowledgements are in order: what follows is based on work carried out by [Paul Germouty](https://fr.linkedin.com/in/paul-germouty-01506314a) some years ago in his role as a researcher at nChain. I've taken up his work, made a few changes, and implemented it in Bitcoin Script. This blogpost and the referenced code are the result of our joint efforts!

Recently, [Robin Linus](https://robinlinus.com) came up with a similar idea using Schnorr signatures: [$\texttt{OP\\_CAT}$ Enables Scalar Multiplication for EC Points](https://gist.github.com/RobinLinus/8890ded496c9c12796dc6a65c196a147). As he noticed, Schnorr signatures are only able to handle scalar point multiplications of the generator. We go beyond that, and handle arbitrary scalar point multiplications!

# On-chain deployment... Pedersen commitments in Bitcoin Script!

In contrast to the previous blogposts in the series, this time we present the on-chain deployment at the beginning. Given the ability to compute a [scalar point multiplication](#whatisscalarmul), what use case can we come up with? We chose to implement the [Pedersen commitment scheme](https://link.springer.com/chapter/10.1007/3-540-46766-1_9).

In a nutshell, for a fixed couple $B,H$ of points in $\mathsf{secp256k1}$, the commitment to $m \in \mathbb{F}\_{n}$, where $n$ is the order of $\mathsf{secp256k1}$, is given by $C := mB + rH$, where $r \leftarrow \mathbb{F}\_{n}^{\ast}$ is sampled at random. In our implementation, we took

```python
B = secp256k1(
        x=Fq_k1(0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798),
        y=Fq_k1(0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8),
    ) # Generator of secp256k1
H = secp256k1(
    x=Fq_k1(0xD6765EA876740CE709C9CFF7789CBF621609E8CA79134B0C0BA0768E8D3EC7B2),
    y=Fq_k1(0xDF16ACCBBA6D8D44882E95FB0D2BA4E210ABE58A32AD4F0BCC4843204E9C0F8D),
) # Randomly generated point
m = Fr_k1(int.from_bytes(hash256d(bytes("Post #3","utf-8"))))
r = Fr_k1(0xC08C9F217DED54295135BA38DA8E79F6CE7EFC1189BA45CAF87590C18443DE20)
```

We committed to $m$ in [tx/e712..2f2c](https://test.whatsonchain.com/tx/e712ee43d313a7ee27d2ce0c85f241359eb5f859e46384136a9879f14a2b2f2c), and we opened the commitment in [tx/911d..14b4](https://test.whatsonchain.com/tx/911d50ab2a0961bafbbb04f518e4a12f14337c7757d4998492217bbb64b514b4). The code implementing the Pedersen commitment scheme can be found at [zkscript/script_examples/pedersen_commitment](https://github.com/nchain-innovation/zkscript_package/blob/fc20fb743edbc5bc5aba9d16625d50d1f50a3ef4/script_examples/pedersen_commitment).

# <a id="whatisscalarmul">What is scalar point multiplication?</a>

Consider a point $P$ on $\mathsf{secp256k1}$ and an element $b \in \mathbb{F}_{n}$, where $n$ is the order of $\mathsf{secp256k1}$. Our goal is to compute [$Q := bP$](https://en.wikipedia.org/wiki/Elliptic_curve_point_multiplication), how can we do that?

The standard approach is to use the double-and-add algorithm:

$$
\begin{array}{ll}
        \textbf{Input:} & P \in \mathsf{secp256k1}, b = (b_m b_{m-1} \dots b_1 b_0)_2 \in \mathbb{F}_{n}\\
        \textbf{Output:} & bP\\
        \textbf{Algorithm:} & {}\\
        {} & T = P\\
        {} & \textbf{for i = m-1 to 0 do:}\\
        {} & \quad \quad T \leftarrow 2T\\
        {} & \quad \quad T \leftarrow T + P \quad \text{if } b_i = 1
    \end{array}
    $$

 where $(b_m b_{m-1} \dots b_1 b_0)_2$ is the binary decomposition of $b$. This algorithm, that we implemented [here](https://github.com/nchain-innovation/zkscript_package/blob/3542301bd756e286580b3bf6abff8f8b95e574d7/src/zkscript/elliptic_curves/ec_operations_fq_unrolled.py#L33), has a big drawback: for loops don't exist in [Bitcoin Script](https://wiki.bitcoinsv.io/index.php/Opcodes_used_in_Bitcoin_Script), so we must unroll the algorithm for the *maximum value $b$ can attain.*

If we we want a script that computes $bP$ for $b \leq 2^{10}$, then we must unroll a loop of length $10$. If we want $b \leq 2^{100}$, then the loop has length $100$, and so on. It's clear that the size of the script grows quite fast, and indeed for $b = 2^{256}$, as required by $\mathsf{secp256k1}$, the size of the script that computes the double-and-add algorithm is 27KB.[^1]

The question is: can we do better? Keep reading to learn the answer!

# Verify, don't compute

*Yes, we can do better!* The trick is to *verify* that a point $Q$ is equal to $bP$ rather than computing $bP$ from scratch. Let's offload the computation and verify that it was performed correctly.

Unfortunately, Bitcoin Script doesn't have any opcode that computes scalar point multiplications on $\mathsf{secp256k1}$, so how do we verify $Q = bP$? As the name of the post gives away, we use [$\texttt{OP\\_CHECKSIG}$](https://wiki.bitcoinsv.io/index.php/OP_CHECKSIG)!

The rest of the blogpost builds up to the script that verifies $Q = bP$, where $Q, P \in \mathsf{secp256k1}$ and $b \in \mathbb{F}_{n}$. We first consider the easier case $P = G$, where $G$ is the generator of $\mathsf{secp256k1}$, and then we generalise to any $P$ in $\mathsf{secp256k1}$ which is not the point at infinity.

# <a id="underground">Underground case: the generator up to epsilon</a>

Given $Q \in \mathsf{secp256k1}$ and $b \in \mathbb{F}_{n}$, how do we verify $Q = bG$? If $(sk, pk)$ is a private-public key pair for $\mathsf{secp256k1}$ and $m$ is a fixed message, then a signature $\sigma$ is such that

$$
1 \leftarrow \mathsf{ECDSAb}\mathsf{.verify}(\sigma, m, pk)
$$

 only if (up to a negligible probability) $\sigma$ is a signature of the message $m$ generated with the private key $sk$. Hence, to verify that $Q = bG$ we could:

-   Fix a message $m$
-   Compute $\sigma := (G_x,s) \leftarrow \mathsf{ECDSAb}\mathsf{.sign}(m,b)$ with ephemeral key $k = 1$[^2]
-   Check that $\mathsf{ECDSAb}\mathsf{.verify}(\sigma, m , Q)$ accepts

Unfortunately, there's a catch: there are two points for which $\mathsf{ECDSAb}\mathsf{.verify}$ accepts. Let's see why this is the case.

We know that $Q = b'G$ for some $b' \in \mathbb{F}_{n}$, so the question is to verify that $b' = b$. The algorithm $\mathsf{ECDSAb}\mathsf{.verify}$ returns $1$ if and only if

$$
G_x = (s^{-1} \mathsf{HASH256}(m) \cdot G + s^{-1} G_x \cdot Q)_x \mod n
$$

 As $p - n < G_x < n$, where $p$ is the prime over which $\mathsf{secp256k1}$ is defined, the above equality is equivalent to

$$
G_x = (s^{-1} \mathsf{HASH256}(m) \cdot G + s^{-1} G_x \cdot Q)_x
$$

 which in turn is equivalent to (passing to the discrete logarithms of the points)

$$
s = \pm (\mathsf{HASH256}(m) + b' G_x) \mod n
$$

 Now we see why there are going to be two solutions: there is a plus *or* minus in the verification equation!

Let's keep going. As we computed $s$ using $b$ as a private key, we know that

$$
s = \mathsf{HASH256}(m) + b G_x \mod n
$$

 and therefore $\mathsf{ECDSAb}\mathsf{.verify}(\sigma, m, Q)$ returns $1$ as long as

$$
\mathsf{HASH256}(m) + b G_x = \pm (\mathsf{HASH256}(m) + b' G_x) \mod n
$$

 Now we got it: the above equation is satisfied if

$$
b' = b \mod n \quad \text{or} \quad b' = b \; \underbrace{- \; 2 \left( \frac{\mathsf{HASH256}(m)}{G_x} + b \right)}_{\varepsilon_b} \mod n
$$

The algorithm below, which summarises the above discussion, is going to be fundamental in what follows:

$$
\begin{array}{ll}
        \textbf{Input:} & Q \in \mathsf{secp256k1},  b \in \mathbb{F}_{n}\\
        \textbf{Output:} & (Q \overset{?}{=} b G) \; \text{or} \; (Q \overset{?}{=} (b + \varepsilon_b) G)\\
        \textbf{Algorithm:} & \\
        {} & 1. \; \sigma \leftarrow \mathsf{ECDSAb}\mathsf{.sign}(m,b) \text{ with } k = 1\\
        {} & 2. \; \mathsf{ECDSAb}\mathsf{.verify}\left( \sigma, m, Q \right)
    \end{array}
    $$

 We write [$\texttt{[BASE\\_POINT\\_UP\\_TO\\_EPSILON]}$](https://github.com/nchain-innovation/zkscript_package/blob/f258aed70445dd3410799a6289cc14a249311681/src/zkscript/elliptic_curves/secp256k1/secp256k1.py#L119) for the implementation in Bitcoin Script of the above algorithm. $\texttt{OP\\_CHECKSIG}$ comes into play in Step 2, which is equivalent to: $\texttt{<}Q \texttt{>}\; \; \texttt{OP\\_CHECKSIG}$, where the message is $m = \mathsf{PreSigHash}(\mathsf{tx}, \mathsf{ix}, \mathsf{ALL})$, see [Message digest algorithm]({{ '/2024/12/04/what-is-that-notation.html' | relative_url }}#message-digest-alg).

# <a id="basecase">Base case: the generator</a>

[We know](#underground) how to verify that $Q = bG$ or $Q = (b + \varepsilon_b)G$, but we need more: we must be able to verify $Q = bG$. How do we get there? The idea is that $\varepsilon_b$ is very constrained: it does not vary well when we vary $b$. In fact, it's so constrained that to verify that $Q = bG$ it's enough to execute [$\texttt{[BASE\\_POINT\\_UP\\_TO\\_EPSILON]}$](https://github.com/nchain-innovation/zkscript_package/blob/f258aed70445dd3410799a6289cc14a249311681/src/zkscript/elliptic_curves/secp256k1/secp256k1.py#L119) twice: once on $Q$ and $b$, and once on $-Q$ and $-b$.

Let's see why this is the case:

![The verification flow for scalar multiplication of the base point]({{ '/assets/posts/curve-operations/verify-base-point.png' | relative_url }})

So, if we run [$\texttt{[BASE\\_POINT\\_UP\\_TO\\_EPSILON]}$](https://github.com/nchain-innovation/zkscript_package/blob/f258aed70445dd3410799a6289cc14a249311681/src/zkscript/elliptic_curves/secp256k1/secp256k1.py#L119) twice: once on $Q, b$, and once on $-Q, -b$, then two successes mean $Q = bG$ except in two edge cases. How can we get rid of them? The case $\mathsf{HASH256}(m) = 0$ happens with negligible probability, so we can discard it, while we can verify $b \neq -\mathsf{HASH256}(m) / G_x \mod n$.

Summing up, we have the following algorithm:

$$
\begin{array}{ll}
        \textbf{Input:} & Q \in \mathsf{secp256k1},  b \in \mathbb{F}_{n}\\
        \textbf{Output:} & Q \overset{?}{=} b G\\
        \textbf{Algorithm:} & \\
        {} & 1. \; \text{Verify that } b \cdot G_x \neq -\mathsf{HASH256}(m) \mod n\\
        {} & 2. \; bit_1 \leftarrow \texttt{<}Q \texttt{>}\; \; \texttt{<}b \texttt{>}\; \; \texttt{[BASE\_POINT\_UP\_TO\_EPSILON]}\\
        {} & 3. \; bit_2 \leftarrow \texttt{<}-Q \texttt{>}\; \; \texttt{<}-b \texttt{>}\; \; \texttt{[BASE\_POINT\_UP\_TO\_EPSILON]}\\
        {} & 4. \; \text{Return } (bit_1 \; \mathrm{AND} \; bit_2)
    \end{array}
    $$

 whose implementation we call [$\texttt{[VERIFY\\_BASE\\_POINT]}$](https://github.com/nchain-innovation/zkscript_package/blob/f258aed70445dd3410799a6289cc14a249311681/src/zkscript/elliptic_curves/secp256k1/secp256k1.py#L363). It's looking good: we now know how to verify $Q = bG$, we're one step closer to our goal!

# <a id="generalcase">The general case</a>

The final step: how do we verify $Q = bP$ when $P \neq G$ and $P$ is not the point at infinity? The point is that, for $P'$ on $\mathsf{secp256k1}$, $\mathsf{ECDSAb}\mathsf{.verify}(\sigma, m, P')$ is secretly verifying a scalar point multiplication involving $P'$! Indeed, it returns $1$ if

$$
r = (s^{-1} \mathsf{HASH256}(m) G + s^{-1} r P')_x \mod n
$$

 Let us write $R$ for the point with $x$ coordinate equal to $r$, and assume $p - n < r < n$.[^3] The equation above is equivalent to

$$
\boxed{R = \pm (s^{-1} \mathsf{HASH256}(m) G + s^{-1} r P') = \pm \frac{r}{s} \left( P' + \frac{\mathsf{HASH256}(m)}{r} G \right)}
$$

 Now, if we set

$$
R = Q, \quad \frac{r}{s} = \frac{Q_x}{s} = b, \quad P' = P - \frac{\mathsf{HASH256}(m)}{Q_x} G
$$

 the above equations simplifies to $Q = \pm bP$. Namely, $\mathsf{ECDSAb}\mathsf{.verify}(\sigma, m, P')$ with $\sigma = (Q_x, Q_x / b)$, returns $1$ if and only if $Q = \pm b P$!

Great, it looks we're almost done: we know how to verify $Q = \pm bP$. How do we get rid of the negative case? We use a trick similar to the one employed in [Base case: the generator](#basecase): we verify that $Q = \pm bP$, and that $Q + bG = \pm b (P + G)$.

![The verification flow for arbitrary scalar point multiplication]({{ '/assets/posts/curve-operations/verify-point-multiplication.png' | relative_url }})

Exactly as in [Base case: the generator](#basecase), executing $\mathsf{ECDSAb}\mathsf{.verify}$ twice ensures that $Q = bP$, except in the edge case $b = 0$. To get a working algorithm, we verify $b \neq 0$:

$$
\begin{array}{ll}
        \textbf{Input:} & Q, P \in \mathsf{secp256k1},  b \in \mathbb{F}_{n}\\
        \textbf{Output:} & Q \overset{?}{=} b P\\
        \textbf{Algorithm:} & \\
        {} & 1. \; \text{Verify that } b \neq 0 \mod n\\
        {} & 2. \; \text{Verify that } p - n < Q_x, (Q + bG)_x < n\\
        {} & 3. \; \sigma \leftarrow \left( Q_x, \frac{Q_x}{b} \right)\\
        {} & 4. \; bit_1 \leftarrow \mathsf{ECDSAb}\mathsf{.verify}\left( \sigma, m, P - \frac{\mathsf{HASH256}(m)}{Q_x} G \right)\\
        {} & 5. \; \sigma \leftarrow \left( (Q+bG)_x, \frac{(Q+bG)_x}{b} \right)\\
        {} & 6. \; bit_2 \leftarrow \mathsf{ECDSAb}\mathsf{.verify}\left( \sigma, m, P + G - \frac{\mathsf{HASH256}(m)}{(Q + bG)_x} G \right)\\
        {} & 7. \; \text{Return } (bit_1 \; \mathrm{AND} \; bit_2)
    \end{array}
    $$

 It was a long road full of obstacles, but we managed to get through it: we now have an algorithm that verifies $Q = bP$ using only $\mathsf{ECDSAb}\mathsf{.verify}$. This means we can implement the algorithm in Bitcoin Script!

# The implementation

Math is fun, but let's see some code, right? [$\texttt{[VERIFY\\_SCALAR\\_MUL]}$](https://github.com/nchain-innovation/zkscript_package/blob/f258aed70445dd3410799a6289cc14a249311681/src/zkscript/elliptic_curves/secp256k1/secp256k1.py#L775) is the implementation of the algorithm described in [The general case](#generalcase). Admittedly, the code is complicated, so we'll attempt to give an explanation here:

-   Step 1, Step 2: These are easy, it's just math. For example $b \neq 0 \mod n$ can be checked as

    $$
    \texttt{<}b \texttt{>}\; \texttt{<}n \texttt{>}\; \texttt{OP\_MOD} \; \texttt{OP\_0NOTEQUAL} \; \texttt{OP\_VERIFY}
    $$

-   Step 3: Here we construct $\sigma \leftarrow \left( Q_x, Q_x / b \right)$. We get a hint $s_1$ from the spender which is purported to be $Q_x / b$. We verify $s_1 \cdot b = Q_x \mod n$, and then we transform $Q_x$, $s_1$ into a DER-encoded signature in a similar way to how we handled [$\texttt{[PUSHTX]}$]({{ '/2024/12/04/covenants-transaction-introspection-pushtx.html' | relative_url }}#computing-mathsfecdsabmathsfsignm1-in-bitcoin-script).

-   Step 4: This is where the tricky part starts. We have the signature, but we need the public key $P - \frac{\mathsf{HASH256}(m)}{Q_x} G$. Subtraction of points on an elliptic curve is easy to compute using the [elliptic curve utilities](https://github.com/nchain-innovation/zkscript_package/blob/main/src/zkscript/elliptic_curves/ec_operations_fq.py) provided by zkscript. However, scalar point multiplication is very heavy. But wait, it's a scalar point multiplication of the generator! We:
    - Get a hint $D_1$ from the user and verify that $D_1 = \frac{\mathsf{HASH256}(m)}{Q_x} G$ using [$\texttt{[VERIFY\\_BASE\\_POINT]}$](https://github.com/nchain-innovation/zkscript_package/blob/f258aed70445dd3410799a6289cc14a249311681/src/zkscript/elliptic_curves/secp256k1/secp256k1.py#L363)
    - Then, we compute $P - D_1$ using [point_algebraic_addition](https://github.com/nchain-innovation/zkscript_package/blob/8d433120bf7fbe4a6a44e7e8e36bb2cf4a9807a1/src/zkscript/elliptic_curves/ec_operations_fq.py#L36)

-   Step 5: Here we construct $\sigma \leftarrow \left( (Q + bG)_x, (Q + bG)_x / b \right)$. However, first we must compute compute $Q + bG$, we need $bG$. Once again, we get a hint $D_2$ from the spender and verify that $D_2 = bG$ using [$\texttt{[VERIFY\\_BASE\\_POINT]}$](https://github.com/nchain-innovation/zkscript_package/blob/f258aed70445dd3410799a6289cc14a249311681/src/zkscript/elliptic_curves/secp256k1/secp256k1.py#L363). Then, we compute $Q + D_2 = Q + bG$ and construct the signature.

-   Step 6: As in Step 3, We get a hint $D_3$ which we verify to be equal to $\frac{\mathsf{HASH256}(m)}{(Q + bG)_x} G$, and then compute the public key $P + G - D_3 = P + G - \frac{\mathsf{HASH256}(m)}{(Q + bG)_x} G$.

How big is the resulting script? The size of $\texttt{[VERIFY\\_SCALAR\\_MUL]}$ is $3$KB,[^4] we saved $24$KB in comparison to the double-and-add approach! Great, isn't it?

[^1]: As a standalone script, it would still be manageable. However, if we had to repeat it many times, as it would be the case in some cryptographic protocols, then the script would become too big.

[^2]: We choose $k = 1$ to simplify the implementation.

[^3]: It is almost always the case that there exists two points with coordinate equal to $r \mod n$, in which case the $\pm$ in the equation below this footnote takes care of the ambiguity in choosing $R$. However, there is a small probability that there are four points on $\mathsf{secp256k1}$ whose x-coordinate is equal to $r \mod n$. By restricting to the case $p - n < r < n$, we get rid of this possibility. The general case is tackled in this [GitHub issue](https://github.com/nchain-innovation/zkscript_package/issues/52).

[^4]: This size doesn't take into account costs that can be amortized, like the sighash verification at the end of $\texttt{[VERIFY\\_SCALAR\\_MUL]}$.

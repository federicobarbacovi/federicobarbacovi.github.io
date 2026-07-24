---
layout: post
title: Merkle trees in Bitcoin Script
description: Implementing and optimising Merkle-path verification in Bitcoin Script, with an analysis of the construction's security.
date: 2024-11-03
author: Federico Barbacovi and Luigi Lunardon
tags:
  - Bitcoin Script
  - Merkle trees
  - Cryptography
katex: true
---

Invented by [Ralph Merkle](https://en.wikipedia.org/wiki/Ralph_Merkle) in 1979, [Merkle trees](https://en.wikipedia.org/wiki/Merkle_tree) are binary trees used to aggregate some data $\mathcal{D} := \{ d_1, \dots, d_n \}$ into a root $\mathfrak{r}$ so that it is possible to prove that $d_i$ was aggregated into $\mathfrak{r}$, but it is infeasible to prove that *any* $d' \notin \{ d_1, \dots, d_n \}$ was aggregated into $\mathfrak{r}$.

From proving the integrity of some data shared over an insecure network, to the reduction of the amount of space required to keep track of the dataset $\mathcal{D}$, use cases for Merkle trees are abundant.

In this blogpost, we set out to build a Bitcoin Script implementation of the algorithm that verifies that some data $d$ was aggregated into a Merkle root $\mathfrak{r}$. We use this simple example as a way to introduce Bitcoin scripting and how we approach implementing an algorithm in Bitcoin Script. Hopefully, by the end of this post you will find the topic of Bitcoin scripting a bit more interesting, and a bit less intimidating.

We chose Merkle trees as our working example for two reasons: they play an important role in the implementation of a [STARK](https://starkware.co/wp-content/uploads/2022/05/STARK-paper.pdf) verifier, so the implementation of Merkle trees in Bitcoin Script is not only an fun exercise, it can be used be build *very cool* [stuff](https://github.com/Bitcoin-Wildlife-Sanctuary/bitcoin-circle-stark/tree/main); second, even in their simplicity, the question of *how* to implement the verification algorithm in the most efficient way is non-trivial.

This post was written by Federico Barbacovi and Luigi Lunardon.

## The locking-unlocking script paradigm

Programming in Bitcoin Script is nothing like programming in Python, Rust, C++, etc. A script written in Bitcoin Script is meant to be a *locking script*. Namely, it is meant to be used to lock an amount of satoshis, so that these satoshis can only be spent by a person with knowledge of the correct unlocking script.

The easiest way to picture this framework is by thinking of a prover $\mathcal{P}$ and a verifier $\mathcal{V}$. The prover is in possession of some locked satoshis, and they can spend them only if they convince the verifier of something. $\mathcal{V}$ plays the role of the locking script, while $\mathcal{P}$ is the unlocking script: the locking script *verifies* that the unlocking script supplies the correct information, and that the spender has the right to spend the coins.

Going back to Merkle trees, our goal is to verify that $d$ was aggregated into $\mathfrak{r}$. Then the first question we must ask ourselves is: what is the locking script, and what is the unlocking script? Fortunately, in this case the answer is clear:
-   **Locking script:** the Bitcoin Script implementation of the algorithm that verifies that $d$ was aggregated in $\mathfrak{r}$.
-   **Unlocking script:** the data needed to execute the verification algorithm above.

## The verification algorithm

To implement an algorithm in code, we first need to understand the algorithm. Recall that to construct a Merkle tree, we need two things:

-   The data to be aggregated $\mathcal{D} = \{d_1, \dots, d_n\}$

-   A [cryptographic hash function](https://en.wikipedia.org/wiki/Cryptographic_hash_function) $\mathrm{H}$ (which is the key to the security of the Merkle tree)

For the sake of simplicity, let us assume that $n = 2^N$, $\mathcal{D} = \{ d_1, \dots, d_{2^N} \}$. Then, the Merkle tree associated to $\mathcal{D}$ is the binary tree with $2^N$ leaves labelled as follows:

![The labelling of a binary Merkle tree, from data leaves to its root]({{ '/assets/posts/merkle-trees/tree-labelling.png' | relative_url }})
{: .no-lightbox }

Given this labelling procedure, the way to prove that $d_i$ was aggregated into $\mathfrak{r}$ is to provide a sequence of strings that reconstruct $\mathfrak{r}$ starting from $d_i$. For example, to prove aggregation of $d_2$ in the picture above we would provide a verifier with $d_2$, $h_{0,0}$ and $h_{1,1}$, which are enough to reconstruct $\mathfrak{r}$. As the *auxiliary strings* $h_{0,0}$, $h_{1,1}$ are either concatenated on the left or on the right, we introduce a bit flag to keep track of the position: $0$ concatenate on the right, $1$ concatenate on the left. In the example of $d_2$: $(h_{0,0},1)$, $(h_{1,1},0)$.

Abstracting the above example:

$$
    \mathrm{Path}(d,\mathfrak{r}) := \{ (h_0, aux_0, bit_0), (h_1, aux_1, bit_1), \dots, (h_t, aux_t, bit_t) \}
$$

is *Merkle path of inclusion* for $d$ if
1.  $h_0 = d$, $aux_0 = \mathsf{emptystring}$
2.  $bit_i \in \{0,1\}$
3.  $h_{i+1} = \mathrm{H}( h_i \vert \vert aux_i)$ if $bit_i = 0$, else $h_{i+1} = \mathrm{H}( aux_i \vert \vert h_i)$
4.  $\mathfrak{r}= \mathrm{H}( h_t \vert \vert aux_t)$ if $bit_t = 0$, else $\mathfrak{r}= \mathrm{H}( aux_t \vert \vert h_t)$

Given a Merkle path of inclusion for $d$, the verification algorithm is the following:

$$
\begin{array}{ll}
        \textbf{Input:} & \mathrm{Path}(d,\mathfrak{r})\\
        \textbf{Output:} & 0/1\\
        \textbf{Algorithm:} & \\
        \quad \quad i = 0, & \textbf{assert} \; aux_0 = \mathsf{emptystring}\\
        {} & {}\\
        \quad \quad i = 1, \dots, t-1, & \textbf{assert} \; h_{i+1} = \begin{cases} \mathrm{H}( h_i \vert \vert aux_i) & bit_i = 0\\ \mathrm{H}( aux_i \vert \vert h_i) & bit_i = 1\end{cases}\\
        {} & {}\\
        \quad \quad i = t & \textbf{assert} \; \mathfrak{r}= \begin{cases} \mathrm{H}( h_t \vert \vert aux_t) & bit_t = 0\\ \mathrm{H}( aux_t \vert \vert h_t) & bit_t = 1\end{cases}
    \end{array}
$$

## Bitcoin Script implementation

We now have the definition of a Merkle path of inclusion, and a description of the algorithm that checks the validity of the path. These are all the ingredients we need to construct our locking and unlocking scripts.

First things first, we map the Merkle path of inclusion and the verification algorithm to the locking-unlocking script paradigm:
-   **Locking script:** the verification algorithm
-   **Unlocking script:** the elements of the Merkle path

Ok, that looks easy enough, we just need to implement the verification algorithm. We can do that using a for loop\... except, we cannot. Bitcoin Script does not have for loops, which means we need to unroll every computation. Taking into account Merkle paths of arbitrary length would introduce a big overhead, so we assume that the number of levels of the Merkle tree is known. In our case, as $\vert \mathcal{D}\vert = 2^N$, it is equal to $N+1$.

Then, the locking-unlocking script paradigm can be detailed as follows (note how we use that we are the ones building the locking script, and so we can require the unlocking script to have a specific structure!):
-   **Locking script:** the verification algorithm for $t = N + 1$
-   **Unlocking script:** the elements of the Merkle path, supplied in the following order:

    $$
    aux_N \; bit_N \; \dots \; aux_2 \; bit_2 \; aux_1 \; bit_1 \; d
    $$

With the unlocking script as above, the script implementing the verification algorithm is (we take $\mathrm{H}=$ SHA256 for the concrete implementation):
<div class="math-display">
\[
\begin{array}{lr}
    \texttt{OP\_SHA256} & \text{compute } h_1\\
    \texttt{OP\_SWAP OP\_IF OP\_SWAP OP\_ENDIF OP\_CAT OP\_SHA256} & \text{compute } h_2\\
    \dots & {}\\
    \texttt{OP\_SWAP OP\_IF OP\_SWAP OP\_ENDIF OP\_CAT OP\_SHA256} & \text{compute } h_{N+1}\\
    \mathtt{\langle root\rangle\ OP\_EQUALVERIFY} & \text{verify } h_{N+1} = \mathfrak{r}
\end{array}
\]
</div>

You can find an implementation of the above script [here](https://github.com/nchain-innovation/zkscript_package/blob/47841fcad240765f494e6b79f79ebb501796e22f/src/zkscript/merkle_tree/merkle_tree.py#L35).

## Getting rid of conditional branches

Dealing with conditional branches in Bitcoin Script is not the easiest thing. It requires the spender to supply a flag $0/1$ in the unlocking script, which must then be handled by the locking script, resulting in an overhead in script size (which is bad, as the cost of publishing a transaction is proportional to its size). We then started wondering whether we could get rid of the $\texttt{OP\\_IF}$'s. It turns out that we can!

The thing to realise is that we could replace the bit flag $bit_i$ with an empty string put in the right place. That is, if we define

$$
\begin{cases}
    aux_{i,1} = \mathsf{emptystring} \quad aux_{i,2} = aux_i & \text{if} \quad bit_i = 0\\
    aux_{i,1} = aux_i \quad aux_{i,2} = \mathsf{emptystring} & \text{if} \quad bit_i = 1
\end{cases}
$$

then

$$
aux_{i,1} \vert \vert h_i \vert \vert aux_{i,2} =
\begin{cases}
    h_i \vert \vert aux_i & bit_i = 0\\
    aux_i \vert \vert h_i & bit_i = 1
\end{cases}
$$

and in the verification algorithm instead of checking whether $bit_i$ is $0$ or $1$, we simply perform two concatenations.

With this idea in mind, we redefine a Merkle path of inclusion as follows:

$$
\mathrm{Path_{triplet}}(d,\mathfrak{r}) := \{ (aux_{0,1}, h_0, aux_{0,2}), (aux_{1,1}, h_1, aux_{1,2}), \dots, (aux_{t,1}, h_t, aux_{t,2}) \}
$$

such that:
1.  $h_0 = d$, $aux_{0,1} = aux_{0,2} = \mathsf{emptystring}$
2.  $h_{i+1} = \mathrm{H}(aux_{i,1} \vert \vert h_i \vert \vert aux_{i,2})$
3.  $\mathfrak{r}= \mathrm{H}(aux_{t,1} \vert \vert h_t \vert \vert aux_{t,2})$

and the verification algorithm accordingly. Then, we can modify the locking-unlocking script paradigm as follows:
-   **Locking script:** the verification algorithm for $\mathrm{Path}_{triplet}$ with $t = N + 1$
-   **Unlocking script:** the elements of the Merkle path, supplied in the following order:

    $$
    aux_{t,1} \; aux_{t,2} \; \dots \; aux_{2,1} \; aux_{2,2} \; aux_{1,1} \; aux_{1,2} \; d
    $$

and implement a locking script verifying the validity of $\mathrm{Path}_{triplet}(d,\mathfrak{r})$:
<div class="math-display">
\[
\begin{array}{lr}
    \texttt{OP\_SHA256} & \text{compute } h_1\\
    \texttt{OP\_SWAP OP\_CAT OP\_CAT OP\_SHA256} & \text{compute } h_2\\
    \dots & {}\\
    \texttt{OP\_SWAP OP\_CAT OP\_CAT OP\_SHA256} & \text{compute } h_{N+1}\\
    \mathtt{\langle root\rangle\ OP\_EQUALVERIFY} & \text{verify } h_{N+1} = \mathfrak{r}
\end{array}
\]
</div>
You can find an implementation of the above script [here](https://github.com/nchain-innovation/zkscript_package/blob/47841fcad240765f494e6b79f79ebb501796e22f/src/zkscript/merkle_tree/merkle_tree.py#L79).

## On-chain deployment

Given all the hard work we have done, it would be nice to see a real-world deployment of the above scripts, right? We thought the same, so we used the scripts developed above to lock the first output of [transaction/983d\...7c33b](https://test.whatsonchain.com/tx/983dea568734ad6ce115b19353c6dd78b18f4e7b5c99b3c0b9aa586880f7c33b). As a Merkle root, we used the Merkle root of the block [#1644208](https://test.whatsonchain.com/block/00000000000024e5c426bae95f62425383de42a5f7645ee1f850911c2b33fe12) (BSV testnet).

What does this mean? That to spend the first output of [transaction/983d\...7c33b](https://test.whatsonchain.com/tx/983dea568734ad6ce115b19353c6dd78b18f4e7b5c99b3c0b9aa586880f7c33b) you need to put in the unlocking script a transaction that was mined in block [#1644208](https://test.whatsonchain.com/block/00000000000024e5c426bae95f62425383de42a5f7645ee1f850911c2b33fe12), together with its Merkle path of inclusion. We spent the UTXO in [transaction/2722\...96d0](https://test.whatsonchain.com/tx/27229d78ae6004ba2508b3c9b0826172dda83daeff07ec8b0bce802e954c96d0) using the Merkle path of inclusion of [transaction/403d\...e463b](https://test.whatsonchain.com/tx/403d6c7da604e60305587bd7e0a50e4a956fff8d6e1f291d1ccd51ff591e463b). In other words, we have just verified on-chain that [transaction/403d\...e463b](https://test.whatsonchain.com/tx/403d6c7da604e60305587bd7e0a50e4a956fff8d6e1f291d1ccd51ff591e463b) was included on-chain.

## Conclusion

We are (almost) at the end. We have explained the locking-unlocking script paradigm, we presented an implementation in Bitcoin of the algorithm verifying that some data $d$ was aggregated into a Merkle root $\mathfrak{r}$, and then we explained how to optimise the script by modifying the verification algorithm.

To be fair, the implementation of the locking script verifying the validity of $\mathrm{Path}_{triplet}$ only saves to $2$ bytes per level of the Merkle tree, so it is not an astonishing gain. Nevertheless, it was fun to see how attempting to remove conditional branches from the verification algorithm of a Merkle tree brought us to a different definition of a Merkle path. Even more, this project gave us the perfect opportunity to introduce our approach to Bitcoin scripting.

We hope you enjoyed this post. If you want to see some more scripting projects, feel free to have a loot at our GitHub repository: [zkscript](https://github.com/nchain-innovation/zkscript_package) (as the name gives away, the focus is on Zero-Knowledge, in particular zkSNARKs).

# \... but is our script secure?

We told you we *were* almost done, right? There is one thing left: we must check the security of our script. While the first implementation we presented relies on the standard verification algorithm for data aggregated in a Merkle root, the second used a different definition of Merkle path of inclusion. Therefore, we need to prove that it is infeasible for an adversary to generate a fake Merkle path of inclusion $\mathrm{Path}_{triplet}$.

Let us stress the importance of what we just said. A locking script is used to lock satoshis, namely, money. If the script is insecure, a malicious actor could steal the satoshis locked with that locking script.

For this reason, we now bound the probability that an adversary constructs a fake $\mathrm{Path}_{triplet}$. Because the auxiliary strings are not required to have fixed lengths, collision resistance alone is not quite enough: the adversary may try to make an intermediate hash coincide with a 32-byte substring crossing the boundary between two genuine node labels. We therefore analyse the construction in the [random-oracle model](https://en.wikipedia.org/wiki/Random_oracle), modelling SHA256 as a random function with 256-bit outputs.

We quickly set up some notation. Let $\mathcal{D} = \{d_1, \ldots, d_{2^N}\}$. We call the leaf level level $0$, and number the remaining levels upwards, so that the root is at level $N$. The leaves have labels $H(d_i)$, and every internal node with child labels $L$ and $R$ has label $H(L \mathbin\Vert R)$. Thus, every node label is 32 bytes and every input used to compute an internal-node label is 64 bytes. Let $M = 2^N-1$ be the number of internal nodes.

**Definition 1.** Let $H : \{0,1\}^{\ast} \rightarrow \{0,1\}^{256}$ be a random oracle. Fix the set $\mathcal{D}$ and let $\mathfrak{r}$ be the root of its Merkle tree. The game $\mathrm{Merkle}_{\mathcal{A},\mathcal{D}}$ gives $\mathcal{A}$ the set $\mathcal{D}$, the labelled tree, and oracle access to $H$. The adversary returns data $d'\notin\mathcal{D}$ and a sequence of auxiliary strings. The game returns $1$ if the triplet verifier accepts them as a path from $d'$ to $\mathfrak{r}$, and $0$ otherwise.

We assume that concatenation is byte-aligned, as it is in Bitcoin Script. We count all distinct oracle queries used to construct the tree, made by the adversary, or made while verifying its path. Let $Q$ be their total number, and let $q$ be the number not used in constructing the genuine tree.

**Proposition.** For every adversary $\mathcal{A}$,

$$
\mathbb{P}\!\left[\mathrm{Merkle}_{\mathcal{A},\mathcal{D}} = 1\right]
\leq
\frac{Q(Q-1)}{2^{257}} + \frac{31qM}{2^{256}}.
$$

In particular, the success probability is negligible when the size of the tree and the number of oracle queries are polynomially bounded.

*Proof.* Suppose that the verifier accepts a path for some $d'\notin\mathcal{D}$. Let $h_0=H(d')$, and let $h_1,\ldots,h_N=\mathfrak{r}$ be the successive values computed by the verifier. Since $h_N$ is the genuine root label, there is a first index $r$ for which $h_r$ is the label of a genuine node at level $r$.

If $r=0$, then $h_0=H(d')=H(d_i)$ for some $d_i\in\mathcal{D}$. Because $d'\neq d_i$, two distinct oracle inputs have the same output.

Now suppose that $r>0$. Write $L$ and $R$ for the genuine child labels of the node labelled $h_r$. The genuine computation of this label is

$$
h_r = H(L\mathbin\Vert R),
$$

whereas the path supplied by the adversary makes the verifier compute

$$
h_r = H(aux_{r,1}\mathbin\Vert h_{r-1}\mathbin\Vert aux_{r,2}).
$$

Set $X=L\mathbin\Vert R$ and $X'=aux_{r,1}\mathbin\Vert h_{r-1}\mathbin\Vert aux_{r,2}$. If $X\neq X'$, the two distinct inputs $X$ and $X'$ have the same oracle output. Therefore, unless an oracle collision occurs, we must have $X=X'$.

Assume then that $X=X'$. The 32-byte string $h_{r-1}$ must occur as a byte-aligned window of the 64-byte string $L\mathbin\Vert R$. There are $33$ such windows. The first is $L$ and the last is $R$; either equality would make $h_{r-1}$ a genuine label at level $r-1$, contradicting the choice of $r$. Consequently, $h_{r-1}$ must equal one of the remaining $31$ windows, each of which crosses the boundary between $L$ and $R$.

Across all $M$ internal nodes there are at most $31M$ such cross-boundary targets. Conditioned on the previous transcript and on no oracle collision, every output of a fresh non-tree query is uniformly distributed over $\{0,1\}^{256}$. A union bound over the $q$ non-tree queries therefore bounds the probability of hitting one of these targets by

$$
\frac{31qM}{2^{256}}.
$$

Finally, the probability of any collision among the outputs of the $Q$ distinct oracle queries is at most

$$
\binom{Q}{2}\frac{1}{2^{256}} = \frac{Q(Q-1)}{2^{257}}.
$$

Adding the two bounds proves the proposition. $\square$

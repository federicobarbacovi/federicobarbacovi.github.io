---
layout: page
title: Code
permalink: /code/
katex: true
---

Coding is an integral part of my day-to-day work.
Below is a summary of some of the coding project I'm working (or have worked) on:

- [zkscript](https://github.com/nchain-innovation/zkscript_package):
zkscript is a library containing Bitcoin Script<sup><a href="#footnote">1</a></sup> implementations of various cryptographic primitives.
Among the primitives implemented, there are:
    - a Groth16 verifier (over BLS12-381 and MNT4-753)
    - Merkle trees
    - Pedersen commitments

- [elliptic_curves](https://github.com/nchain-innovation/elliptic_curves_package):
a Python implementation of finite fields, elliptic curve arithmetic, and bilinear pairings.
The library is mostly used as a way to produce test data for [zkscript](https://github.com/nchain-innovation/zkscript_package), and as an interface between [zkscript](https://github.com/nchain-innovation/zkscript_package) and [arkworks](https://github.com/arkworks-rs).

- [bitcoin_r1cs](https://github.com/nchain-innovation/bitcoin_r1cs):
a Rust library containing R1CS equivalents of Bitcoin structures (transactions, inputs, outputs).
The library builds on the [arkworks](https://github.com/arkworks-rs) framework to define structures that can be used to build circuits to prove statements about Bitcoin transactions in zero-knowledge.

- [transaction_chain_proof](https://github.com/nchain-innovation/transaction_chain_proof):
a Rust library containing the implementation of a PCD predicate to prove statements about _transaction chains_.
The idea is to use this predicate to prove that two UTXOs are linked are related to each other.
NFTs are presented as a use case [here](https://github.com/nchain-innovation/zkscript_package/tree/nft_recursive_groth16/nft_example).


[<a name="footnote">1</a>]:
By Bitcoin Script here I mean the scripting language of BSV.
<a href="https://wiki.bitcoinsv.io/index.php/Opcodes_used_in_Bitcoin_Script">Here</a> you can find the available opcodes (i.e., instructions).
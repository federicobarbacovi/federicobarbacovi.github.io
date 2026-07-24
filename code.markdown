---
layout: page
title: Code
permalink: /code/
katex: true
---

Coding is an integral part of my day-to-day work.
Below are some of the cryptographic libraries and research prototypes I work on or have contributed to.

<div class="project-grid">
  <a class="project-card" href="https://github.com/AztecProtocol/aztec-packages/tree/next/barretenberg" data-reveal>
    <span class="project-tags">C++ · Proof systems · Performance</span>
    <h2>barretenberg</h2>
    <p>The cryptographic library powering Aztec. I implemented new primitives, audited code, and changed circuits to deliver substantial prover speedups.</p>
    <span class="card-link">View repository →</span>
  </a>

  <article class="project-card" data-reveal>
    <span class="project-tags">Python · Bitcoin Script · zkSNARKs</span>
    <h2><a href="https://github.com/nchain-innovation/zkscript_package">zkscript</a></h2>
    <p>Bitcoin Script<sup><a href="#footnote" aria-label="See footnote 1">1</a></sup> implementations of cryptographic primitives, including Groth16 verifiers, Merkle trees, secp256k1 scalar multiplication, and Pedersen commitments.</p>
    <a class="card-link" href="https://github.com/nchain-innovation/zkscript_package">View repository →</a>
  </article>

  <a class="project-card" href="https://github.com/nchain-innovation/bitcoin_r1cs" data-reveal>
    <span class="project-tags">Rust · R1CS · Zero knowledge</span>
    <h2>bitcoin_r1cs</h2>
    <p>R1CS equivalents of Bitcoin transactions, inputs, and outputs, built on arkworks to prove statements about Bitcoin transactions in zero knowledge.</p>
    <span class="card-link">View repository →</span>
  </a>

  <a class="project-card" href="https://github.com/nchain-innovation/elliptic_curves_package" data-reveal>
    <span class="project-tags">Python · Elliptic curves · Pairings</span>
    <h2>elliptic_curves</h2>
    <p>Finite fields, elliptic-curve arithmetic, and bilinear pairings, used to generate zkscript test data and interface with arkworks.</p>
    <span class="card-link">View repository →</span>
  </a>

  <a class="project-card" href="https://github.com/nchain-innovation/tcpBridge" data-reveal>
    <span class="project-tags">Sui · BSV · Bridge</span>
    <h2>tcpBridge</h2>
    <p>A proof-of-concept bridge between Sui and BSV that wraps Sui in BSV transaction outputs and connects the supporting cryptographic libraries.</p>
    <span class="card-link">View repository →</span>
  </a>

  <a class="project-card" href="https://github.com/nchain-innovation/transaction_chain_proof" data-reveal>
    <span class="project-tags">Rust · PCD · UTXO</span>
    <h2>transaction_chain_proof</h2>
    <p>A PCD predicate proving statements about transaction chains. NFTs provide one motivating use case.</p>
    <span class="card-link">View repository →</span>
  </a>
</div>
<aside class="page-note" id="footnote">
  <span class="page-note__marker">1</span>
  <p>By Bitcoin Script here I mean the scripting language of BSV. <a href="https://wiki.bitcoinsv.io/index.php/Opcodes_used_in_Bitcoin_Script">Here</a> you can find the available opcodes (i.e., instructions).</p>
</aside>

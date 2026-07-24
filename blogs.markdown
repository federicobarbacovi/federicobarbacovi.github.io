---
layout: page
title: Writing
permalink: /blogs-and-notes/
katex: true
---

Technical articles and notes about Bitcoin Script, cryptographic primitives, and the mathematics behind them.

# Posts

<article class="writing-card" data-reveal>
  <p class="writing-meta">Series · Part III</p>
  <h2><a href="{{ '/2025/01/03/efficient-operations-bitcoin-curve.html' | relative_url }}">Efficient operations on the Bitcoin curve</a></h2>
  <p>Using <code>OP_CHECKSIG</code> to verify scalar multiplication and Pedersen commitments efficiently on secp256k1.</p>
  <a class="card-link" href="{{ '/2025/01/03/efficient-operations-bitcoin-curve.html' | relative_url }}">Read article →</a>
</article>

<article class="writing-card" data-reveal>
  <p class="writing-meta">Series · Part II</p>
  <h2><a href="{{ '/2025/01/03/efficient-pushtx.html' | relative_url }}">A more efficient PUSHTX</a></h2>
  <p>Reducing the PUSHTX construction from 376 bytes to 82 bytes using bit shifts.</p>
  <a class="card-link" href="{{ '/2025/01/03/efficient-pushtx.html' | relative_url }}">Read article →</a>
</article>

<article class="writing-card" data-reveal>
  <p class="writing-meta">Series · Part I</p>
  <h2><a href="{{ '/2024/12/04/covenants-transaction-introspection-pushtx.html' | relative_url }}">Covenants, transaction introspection and PUSHTX</a></h2>
  <p>Constructing Bitcoin covenants and transaction introspection by using <code>OP_CHECKSIG</code>.</p>
  <a class="card-link" href="{{ '/2024/12/04/covenants-transaction-introspection-pushtx.html' | relative_url }}">Read article →</a>
</article>

<article class="writing-card" data-reveal>
  <p class="writing-meta">Reference · ECDSA · Bitcoin</p>
  <h2><a href="{{ '/2024/12/04/what-is-that-notation.html' | relative_url }}">Notation references</a></h2>
  <p>A reference for the ECDSA, transaction, and message-digest notation used throughout the technical posts.</p>
  <a class="card-link" href="{{ '/2024/12/04/what-is-that-notation.html' | relative_url }}">Open reference →</a>
</article>

<article class="writing-card" data-reveal>
  <p class="writing-meta">Bitcoin Script · Merkle trees</p>
  <h2><a href="{{ '/2024/11/03/merkle-trees-in-bitcoin-script.html' | relative_url }}">Merkle trees in Bitcoin Script</a></h2>
  <p>Implementing and optimising Merkle-path verification in Bitcoin Script, followed by a security analysis of the construction.</p>
  <a class="card-link" href="{{ '/2024/11/03/merkle-trees-in-bitcoin-script.html' | relative_url }}">Read article →</a>
</article>

# Notes

<article class="writing-card note-card" data-reveal>
  <p class="writing-meta">Mathematical notes · PDF</p>
  <h2><a href="{{ '/pdf/bilinear_pairings.pdf' | relative_url }}">Notes on bilinear pairings</a></h2>
  <p>An introduction to bilinear pairings, written as a mathematical companion to the <a href="https://github.com/nchain-innovation/zkscript_package">zkscript</a> implementation.</p>
  <a class="card-link" href="{{ '/pdf/bilinear_pairings.pdf' | relative_url }}">Read the notes →</a>
</article>

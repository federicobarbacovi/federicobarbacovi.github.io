---
layout: home
---

<section class="hero" data-reveal>
  <div class="hero-glow" aria-hidden="true"></div>
  <p class="eyebrow">Cryptography · Zero Knowledge · Blockchain</p>
  <h1>I build secure and performant cryptographic and blockchain systems.</h1>
  <p class="hero-lede">I’m Federico Barbacovi, a cryptography engineer and mathematician working on zero-knowledge proofs, blockchain protocols, Bitcoin, and high-performance software.</p>
  <div class="hero-actions">
    <a class="button button--primary" href="{{ '/code/' | relative_url }}">Explore my work <span aria-hidden="true">→</span></a>
    <a class="button button--quiet" href="{{ '/research/' | relative_url }}">View research</a>
  </div>
</section>

<section class="home-section" aria-labelledby="explore-heading">
  <div class="section-heading" data-reveal>
    <p class="eyebrow">Explore</p>
    <h2 id="explore-heading">Work across theory and implementation</h2>
  </div>
  <div class="feature-grid">
    <a class="feature-card" href="{{ '/research/' | relative_url }}" data-reveal>
      <span class="card-index">01</span>
      <h3>Research</h3>
      <p>Research in applied cryptography, zero-knowledge proofs, blockchain protocols, and algebraic geometry.</p>
      <span class="card-link">Read the papers <span aria-hidden="true">→</span></span>
    </a>
    <a class="feature-card" href="{{ '/code/' | relative_url }}" data-reveal>
      <span class="card-index">02</span>
      <h3>Code</h3>
      <p>Cryptographic primitives, proof systems, blockchain infrastructure, Bitcoin Script, and performance engineering.</p>
      <span class="card-link">Browse projects <span aria-hidden="true">→</span></span>
    </a>
    <a class="feature-card" href="{{ '/blogs-and-notes/' | relative_url }}" data-reveal>
      <span class="card-index">03</span>
      <h3>Writing</h3>
      <p>Technical articles and notes that unpack the ideas behind the implementations.</p>
      <span class="card-link">Start reading <span aria-hidden="true">→</span></span>
    </a>
  </div>
</section>

<section class="home-section selected-work" aria-labelledby="selected-heading">
  <div class="section-heading" data-reveal>
    <p class="eyebrow">Selected work</p>
    <h2 id="selected-heading">From proof systems to blockchain protocols</h2>
  </div>
  <div class="work-list">
    <a href="https://github.com/AztecProtocol/aztec-packages/tree/next/barretenberg" class="work-item" data-reveal>
      <span class="work-meta">Cryptography · C++</span>
      <h3>barretenberg</h3>
      <p>Cryptographic primitives, protocol audits, and substantial prover performance improvements for Aztec.</p>
    </a>
    <a href="https://github.com/nchain-innovation/zkscript_package" class="work-item" data-reveal>
      <span class="work-meta">Bitcoin Script · zkSNARKs</span>
      <h3>zkscript</h3>
      <p>Bitcoin Script implementations of Groth16 verification, elliptic-curve arithmetic, Merkle trees, and more.</p>
    </a>
  </div>
</section>

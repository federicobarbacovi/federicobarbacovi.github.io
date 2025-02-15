---
layout: page
title: Blogs & Notes
permalink: /blogs-and-notes/
katex: true
---

Below is a list of some stuff I wrote (which will, hopefully, keep growing)

# Posts

- [$$\texttt{OP\_CHECKSIG}$$](https://en.bitcoin.it/wiki/OP_CHECKSIG) beyond signature validation: series of blogs on the uses of $$\texttt{OP\_CHECKSIG}$$ beyond transaction introspection. Check out the posts for code and on-chain transactions!
    - [Covenants, transaction introspection and $$\texttt{[PUSHTX]}$$](https://hackmd.io/@federicobarbacovi/By6zkFmfyl): a blog about constructing Bitcoin scripts that achieve transaction introspection, which we call $$\texttt{[PUSHTX]}$$.
    - [A more efficient PUSHTX](https://hackmd.io/@federicobarbacovi/H1DqEzfm1l): improving on the first blog in the series, we show how to construct an efficient $$\texttt{[PUSHTX]}$$.
    - [Efficient operations on the Bitcoin curve](https://hackmd.io/@federicobarbacovi/BkxI6ZvVye): to conclude the series, we show how to use $$\texttt{OP\_CHECKSIG}$$ to verify group operations on the Bitcoin curve [$$\texttt{secp256k1}$$](https://en.bitcoin.it/wiki/Secp256k1).

- [Merkle trees in Bitcoin Script](https://hackmd.io/@federicobarbacovi/BybFoBplJx): a blog about implementing Merkle trees in Bitcoin Script. Check out the blog for links to transactions and code.

# Notes

- [Notes on bilinear pairings](./pdf/bilinear_pairings.pdf): notes I wrote on bilinear pairings as a companion to the Github repository [zkscript](https://github.com/nchain-innovation/zkscript_package).
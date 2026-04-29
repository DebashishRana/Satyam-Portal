# Contributing to Satyam Portal

Thank you for your interest in contributing to Satyam Portal! This document provides guidelines and instructions for contributing.

## Development Setup

1. Fork and clone the repository
2. Follow the [Quick Start](README.md#quick-start) instructions
3. Create a new branch for your feature

## Coding Standards

### Python (Backend)
- Follow PEP 8 style guide
- Use type hints where possible
- Write docstrings for all functions and classes
- Run `pytest` before committing

### TypeScript/React (Frontend)
- Use functional components with hooks
- Follow the existing file structure
- Use TypeScript strictly - no `any` types
- Run `npm run lint` before committing

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the documentation
3. Ensure all tests pass
4. Link any related issues

## Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

Types: feat, fix, docs, style, refactor, test, chore

Example:
```
feat(evaluation): add verification card component

Implements the verification card UI for displaying
criterion-level evaluation results with evidence links.

Closes #123
```

## Questions?

Feel free to open an issue for discussion before starting major work.

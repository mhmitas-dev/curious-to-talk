# Niribi Engineering Documentation

This directory records how Niribi is structured and, more importantly, why important boundaries and behaviors exist.

The documentation is intended for engineers and coding agents working on the project. It should describe durable architecture, ownership, constraints, and extension points rather than narrating individual commits.

## Architecture

- [Room Sidebar Applications](./architecture/room-sidebar-applications.md) - The scalable app workspace inside a room, including navigation ownership, module registration, and the current Screen Share, YouTube placeholder, and Spotify placeholder states.
- [Room Stage and Shared Media](./architecture/room-stage-and-shared-media.md) - Stage ownership, synchronization boundaries, and the paused YouTube design notes for future shared media work.

## Documentation Guidelines

Update or add documentation when a change introduces any of the following:

- a new feature area or module boundary;
- a non-obvious state ownership decision;
- a realtime, authentication, database, or media lifecycle;
- behavior that future work must preserve;
- a deliberate limitation or deferred feature;
- a reusable extension pattern.

Keep documentation close to the code conceptually, but avoid comments that duplicate obvious implementation details. Code comments should explain local reasons; these documents should explain system-level decisions.

import { describe, expect, it } from "vitest";
import type { YouTubeActivitySession } from "./room-types";
import {
  doesYouTubeReplacementCompleteRequest,
  encodeYouTubeActivityPacket,
  getYouTubeReplacementRequestDecision,
  isAuthorizedYouTubeReplacement,
  isAuthorizedYouTubeReplacementRejection,
  parseYouTubeActivityPacket,
  shouldAcceptYouTubeSessionCandidate,
  shouldAcceptYouTubeReplacement,
  shouldApplyYouTubeSessionPacket,
  YOUTUBE_HANDOFF_ACCEPT_WINDOW_MS,
  type YouTubeActivityPacket,
} from "./youtube-activity-protocol";

function createSession(
  overrides: Partial<YouTubeActivitySession> = {}
): YouTubeActivitySession {
  return {
    hostIdentity: "host-a",
    playbackStatus: "playing",
    positionSeconds: 12,
    revision: 3,
    sessionId: "session-a",
    updatedAt: 1_000,
    videoId: "abcdefghijk",
    ...overrides,
  };
}

describe("YouTube activity packet parsing", () => {
  it("round-trips an existing playback packet", () => {
    const packet: YouTubeActivityPacket = {
      sentAt: 1_100,
      session: createSession(),
      type: "youtube:seek",
    };

    expect(parseYouTubeActivityPacket(encodeYouTubeActivityPacket(packet))).toEqual(
      packet
    );
  });

  it("parses all replacement packet shapes", () => {
    const replacement = createSession({
      hostIdentity: "host-b",
      positionSeconds: 0,
      revision: 1,
      sessionId: "session-b",
      videoId: "lmnopqrstuv",
    });
    const packets: YouTubeActivityPacket[] = [
      {
        activeSessionId: "session-a",
        expiresAt: 1_200 + YOUTUBE_HANDOFF_ACCEPT_WINDOW_MS,
        requestId: "request-a",
        sentAt: 1_200,
        type: "youtube:replace-request",
        videoId: replacement.videoId,
      },
      {
        previousSessionId: "session-a",
        requestId: "request-a",
        sentAt: 1_300,
        session: replacement,
        type: "youtube:replace",
      },
      {
        activeSessionId: "session-a",
        reason: "busy",
        requestId: "request-b",
        sentAt: 1_400,
        type: "youtube:replace-rejected",
      },
    ];

    for (const packet of packets) {
      expect(
        parseYouTubeActivityPacket(encodeYouTubeActivityPacket(packet))
      ).toEqual(packet);
    }
  });

  it("rejects malformed sessions and replacement packets", () => {
    const malformed = new TextEncoder().encode(
      JSON.stringify({
        previousSessionId: "session-a",
        requestId: "request-a",
        sentAt: 1_300,
        session: createSession({ revision: 0 }),
        type: "youtube:replace",
      })
    );

    expect(parseYouTubeActivityPacket(malformed)).toBeNull();
  });

  it("rejects handoff requests with an invalid acceptance window", () => {
    const malformed = new TextEncoder().encode(
      JSON.stringify({
        activeSessionId: "session-a",
        expiresAt: 1_200 + YOUTUBE_HANDOFF_ACCEPT_WINDOW_MS + 1,
        requestId: "request-a",
        sentAt: 1_200,
        type: "youtube:replace-request",
        videoId: "lmnopqrstuv",
      })
    );

    expect(parseYouTubeActivityPacket(malformed)).toBeNull();
  });
});

describe("YouTube session authority", () => {
  it("accepts only current-session revisions during ordinary playback", () => {
    const current = createSession();

    expect(
      shouldApplyYouTubeSessionPacket(
        current,
        createSession({ revision: current.revision + 1 })
      )
    ).toBe(true);
    expect(
      shouldApplyYouTubeSessionPacket(
        current,
        createSession({ revision: current.revision - 1 })
      )
    ).toBe(false);
    expect(
      shouldApplyYouTubeSessionPacket(
        current,
        createSession({ sessionId: "competing-session" })
      )
    ).toBe(false);
  });

  it("rejects ended sessions and candidates while screen share is active", () => {
    const candidate = createSession();

    expect(
      shouldAcceptYouTubeSessionCandidate({
        candidate,
        current: null,
        endedSessionIds: new Set([candidate.sessionId]),
        screenShareActive: false,
      })
    ).toBe(false);
    expect(
      shouldAcceptYouTubeSessionCandidate({
        candidate,
        current: null,
        endedSessionIds: new Set(),
        screenShareActive: true,
      })
    ).toBe(false);
  });
});

describe("YouTube replacement authority", () => {
  const current = createSession();
  const replacementPacket: Extract<
    YouTubeActivityPacket,
    { type: "youtube:replace" }
  > = {
    previousSessionId: current.sessionId,
    requestId: "request-a",
    sentAt: 2_000,
    session: createSession({
      hostIdentity: "host-b",
      playbackStatus: "playing",
      positionSeconds: 0,
      revision: 1,
      sessionId: "session-b",
      updatedAt: 2_000,
      videoId: "lmnopqrstuv",
    }),
    type: "youtube:replace",
  };

  it("accepts a fresh replacement authorized by the current host", () => {
    expect(
      isAuthorizedYouTubeReplacement({
        current,
        packet: replacementPacket,
        senderIdentity: current.hostIdentity,
      })
    ).toBe(true);
  });

  it("accepts replacement only when the stage and candidate are still valid", () => {
    expect(
      shouldAcceptYouTubeReplacement({
        current,
        endedSessionIds: new Set(),
        packet: replacementPacket,
        screenShareActive: false,
        senderIdentity: current.hostIdentity,
      })
    ).toBe(true);
    expect(
      shouldAcceptYouTubeReplacement({
        current,
        endedSessionIds: new Set([replacementPacket.session.sessionId]),
        packet: replacementPacket,
        screenShareActive: false,
        senderIdentity: current.hostIdentity,
      })
    ).toBe(false);
    expect(
      shouldAcceptYouTubeReplacement({
        current,
        endedSessionIds: new Set(),
        packet: replacementPacket,
        screenShareActive: true,
        senderIdentity: current.hostIdentity,
      })
    ).toBe(false);
  });

  it("rejects non-host, stale, and non-fresh replacements", () => {
    expect(
      isAuthorizedYouTubeReplacement({
        current,
        packet: replacementPacket,
        senderIdentity: "host-b",
      })
    ).toBe(false);
    expect(
      isAuthorizedYouTubeReplacement({
        current,
        packet: { ...replacementPacket, previousSessionId: "stale-session" },
        senderIdentity: current.hostIdentity,
      })
    ).toBe(false);
    expect(
      isAuthorizedYouTubeReplacement({
        current,
        packet: {
          ...replacementPacket,
          session: { ...replacementPacket.session, revision: 2 },
        },
        senderIdentity: current.hostIdentity,
      })
    ).toBe(false);
    expect(
      isAuthorizedYouTubeReplacement({
        current,
        packet: {
          ...replacementPacket,
          session: { ...replacementPacket.session, videoId: "invalid" },
        },
        senderIdentity: current.hostIdentity,
      })
    ).toBe(false);
  });

  it("lets the current host lock the first valid handoff request", () => {
    const request: Extract<
      YouTubeActivityPacket,
      { type: "youtube:replace-request" }
    > = {
      activeSessionId: current.sessionId,
      expiresAt: 2_100 + YOUTUBE_HANDOFF_ACCEPT_WINDOW_MS,
      requestId: "request-a",
      sentAt: 2_100,
      type: "youtube:replace-request",
      videoId: "lmnopqrstuv",
    };

    expect(
      getYouTubeReplacementRequestDecision({
        activeRequestId: null,
        current,
        now: 2_200,
        packet: request,
        senderIdentity: "host-b",
      })
    ).toBe("accept");
    expect(
      getYouTubeReplacementRequestDecision({
        activeRequestId: "request-a",
        current,
        now: 2_200,
        packet: { ...request, requestId: "request-b" },
        senderIdentity: "host-c",
      })
    ).toBe("busy");
  });

  it("rejects stale, same-video, and host-originated handoff requests", () => {
    const request: Extract<
      YouTubeActivityPacket,
      { type: "youtube:replace-request" }
    > = {
      activeSessionId: current.sessionId,
      expiresAt: 2_100 + YOUTUBE_HANDOFF_ACCEPT_WINDOW_MS,
      requestId: "request-a",
      sentAt: 2_100,
      type: "youtube:replace-request",
      videoId: "lmnopqrstuv",
    };

    expect(
      getYouTubeReplacementRequestDecision({
        activeRequestId: null,
        current,
        now: 2_200,
        packet: { ...request, activeSessionId: "stale-session" },
        senderIdentity: "host-b",
      })
    ).toBe("stale");
    expect(
      getYouTubeReplacementRequestDecision({
        activeRequestId: null,
        current,
        now: 2_200,
        packet: { ...request, videoId: current.videoId },
        senderIdentity: "host-b",
      })
    ).toBe("invalid");
    expect(
      getYouTubeReplacementRequestDecision({
        activeRequestId: null,
        current,
        now: 2_200,
        packet: request,
        senderIdentity: current.hostIdentity,
      })
    ).toBe("invalid");
  });

  it("rejects handoff requests after their host-acceptance window", () => {
    const request: Extract<
      YouTubeActivityPacket,
      { type: "youtube:replace-request" }
    > = {
      activeSessionId: current.sessionId,
      expiresAt: 2_100 + YOUTUBE_HANDOFF_ACCEPT_WINDOW_MS,
      requestId: "request-expired",
      sentAt: 2_100,
      type: "youtube:replace-request",
      videoId: "lmnopqrstuv",
    };

    expect(
      getYouTubeReplacementRequestDecision({
        activeRequestId: null,
        current,
        now: request.expiresAt,
        packet: request,
        senderIdentity: "host-b",
      })
    ).toBe("stale");
  });

  it("accepts a rejection only from the current host for the pending request", () => {
    const rejection: Extract<
      YouTubeActivityPacket,
      { type: "youtube:replace-rejected" }
    > = {
      activeSessionId: current.sessionId,
      reason: "busy",
      requestId: "request-a",
      sentAt: 2_200,
      type: "youtube:replace-rejected",
    };

    expect(
      isAuthorizedYouTubeReplacementRejection({
        current,
        packet: rejection,
        pendingRequestId: rejection.requestId,
        senderIdentity: current.hostIdentity,
      })
    ).toBe(true);
    expect(
      isAuthorizedYouTubeReplacementRejection({
        current,
        packet: rejection,
        pendingRequestId: "another-request",
        senderIdentity: current.hostIdentity,
      })
    ).toBe(false);
    expect(
      isAuthorizedYouTubeReplacementRejection({
        current,
        packet: rejection,
        pendingRequestId: rejection.requestId,
        senderIdentity: "host-c",
      })
    ).toBe(false);
  });

  it("completes only the exact requester handoff", () => {
    expect(
      doesYouTubeReplacementCompleteRequest({
        activeSessionId: current.sessionId,
        packet: replacementPacket,
        requestId: replacementPacket.requestId,
        requesterIdentity: replacementPacket.session.hostIdentity,
        videoId: replacementPacket.session.videoId,
      })
    ).toBe(true);
    expect(
      doesYouTubeReplacementCompleteRequest({
        activeSessionId: current.sessionId,
        packet: replacementPacket,
        requestId: "another-request",
        requesterIdentity: replacementPacket.session.hostIdentity,
        videoId: replacementPacket.session.videoId,
      })
    ).toBe(false);
    expect(
      doesYouTubeReplacementCompleteRequest({
        activeSessionId: current.sessionId,
        packet: replacementPacket,
        requestId: replacementPacket.requestId,
        requesterIdentity: "host-c",
        videoId: replacementPacket.session.videoId,
      })
    ).toBe(false);
  });
});

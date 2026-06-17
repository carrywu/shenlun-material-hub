import "@testing-library/jest-dom";

/**
 * MSW server is available for opt-in use per test file.
 * Do NOT auto-start here — it conflicts with vi.stubGlobal("fetch") mocking.
 *
 * To use MSW in a test file:
 *   import { server } from "@/test/mocks/server";
 *   beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 */

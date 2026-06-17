import { setupServer } from "msw/node";
import { authHandlers } from "./handlers/auth";
import { articlesHandlers } from "./handlers/articles";
import { aiHandlers } from "./handlers/ai";
import { cardsHandlers } from "./handlers/cards";
import { tasksHandlers } from "./handlers/tasks";
import { wechatRssHandlers } from "./handlers/wechat-rss";
import { adminHandlers } from "./handlers/admin";
import { sourcesHandlers } from "./handlers/sources";

/**
 * MSW server for Vitest (jsdom) environment.
 * Intercepts fetch/XHR requests made during unit/integration tests.
 *
 * Handlers are ordered by specificity — more specific paths first.
 */
export const server = setupServer(
  ...authHandlers,
  ...articlesHandlers,
  ...aiHandlers,
  ...cardsHandlers,
  ...tasksHandlers,
  ...wechatRssHandlers,
  ...adminHandlers,
  ...sourcesHandlers
);

import { Bot, Context, GrammyError, InlineKeyboard } from "grammy";
import * as dotenv from "dotenv";

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN не знайдено в .env файлі!");
}

const WEB_APP_URL = process.env.WEB_APP_URL;
if (!WEB_APP_URL) {
  throw new Error(
    "WEB_APP_URL не знайдено в .env файлі! Додай HTTPS-адресу ngrok/cloudflare tunnel."
  );
}

const bot = new Bot(token);

bot.catch((err) => {
  if (err.error instanceof GrammyError) {
    const desc = err.error.description;
    if (
      desc.includes("message is not modified") ||
      desc.includes("query is too old")
    ) {
      return;
    }
  }

  const ctx = err.ctx;
  console.error(`Помилка при обробці update ${ctx.update.update_id}:`, err.error);

  if (err.error instanceof GrammyError) {
    console.error("Telegram API:", err.error.description);
  }
});

// Головне меню
const mainKeyboard = new InlineKeyboard()
  .text("💰 Баланс", "action_balance")
  .text("🎮 Вибрати гру", "action_games");

// Меню ігор
const gamesKeyboard = new InlineKeyboard()
  .webApp("⭕ Хрестики-нолики", `${WEB_APP_URL}/game1.html`)
  .row()
  .webApp("🧩 П'ятнашки", `${WEB_APP_URL}/game2.html`)
  .row()
  .webApp("🎮 Piastria", `${WEB_APP_URL}/piastria.html`)
  .row()
  .text("⬅️ Назад", "action_back");

const userMessages = new Map<number, number[]>();

function trackMessage(userId: number, messageId: number) {
  const ids = userMessages.get(userId) ?? [];
  if (!ids.includes(messageId)) ids.push(messageId);
  userMessages.set(userId, ids);
}

async function clearBotMessages(ctx: Context, userId: number) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const ids = userMessages.get(userId) ?? [];
  await Promise.allSettled(
    ids.map((messageId) => ctx.api.deleteMessage(chatId, messageId))
  );
  userMessages.delete(userId);
}

async function sendStartScreen(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  const msg = await ctx.reply(
    `Привіт, ${user.first_name || "Користувач"}! Раді бачити тебе в системі.`,
    { reply_markup: mainKeyboard }
  );
  trackMessage(user.id, msg.message_id);
}

async function resetChat(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  await clearBotMessages(ctx, userId);
  try {
    await ctx.deleteMessage();
  } catch {
    // повідомлення вже видалене або недоступне
  }
  await sendStartScreen(ctx);
}

// Команда /start — чистимо чат і показуємо головне меню
bot.command("start", async (ctx) => {
  await resetChat(ctx);
});

// Після закриття Web App — знову чистий старт
bot.on("message:web_app_data", async (ctx) => {
  try {
    const data = JSON.parse(ctx.message.web_app_data.data);
    if (data.action !== "reset") return;
  } catch {
    return;
  }

  await resetChat(ctx);
});

// Коли користувач блокує бота — скидаємо збережені повідомлення
bot.on("my_chat_member", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const status = ctx.myChatMember.new_chat_member.status;
  if (status === "kicked" || status === "left") {
    userMessages.delete(userId);
  }
});

// Кнопка Баланс
bot.callbackQuery("action_balance", async (ctx) => {
  await ctx.answerCallbackQuery();

  const mockBalance = 100.0;

  const balanceKeyboard = new InlineKeyboard()
    .webApp("💳 Поповнити баланс", `${WEB_APP_URL}/deposit.html`)
    .row()
    .text("⬅️ Назад", "action_back");

  await ctx.editMessageText(`💵 Ваш баланс: *${mockBalance} USDT*`, {
    parse_mode: "Markdown",
    reply_markup: balanceKeyboard,
  });
});

// Кнопка Вибрати гру
bot.callbackQuery("action_games", async (ctx) => {
  await ctx.answerCallbackQuery();

  await ctx.editMessageText("Оберіть гру для запуску:", {
    reply_markup: gamesKeyboard,
  });
});

// Кнопка Назад
bot.callbackQuery("action_back", async (ctx) => {
  await ctx.answerCallbackQuery();

  await ctx.editMessageText("Головне меню. Оберіть дію:", {
    reply_markup: mainKeyboard,
  });
});

async function checkWebAppUrl() {
  const testUrl = `${WEB_APP_URL}/deposit.html`;

  try {
    const res = await fetch(testUrl, {
      headers: { "User-Agent": "Telegram-Android" },
    });
    const html = await res.text();

    if (html.includes("ngrok") && html.includes("ERR_NGROK")) {
      console.warn(
        "\n⚠️  ngrok блокує Web App у Telegram (сторінка-попередження).\n" +
          "   Зупини ngrok і запусти: npm run tunnel\n" +
          "   Скопіюй URL *.trycloudflare.com у .env → WEB_APP_URL\n" +
          "   І вкажи цей домен у BotFather → Bot Settings → Domain\n"
      );
    }
  } catch {
    console.warn(`\n⚠️  Не вдалося перевірити WEB_APP_URL: ${testUrl}\n`);
  }
}

// Запуск бота
void checkWebAppUrl();
void bot.api.setMyCommands([
  { command: "start", description: "Головне меню" },
]);
void bot.api.setChatMenuButton({
  menu_button: { type: "commands" },
});
bot.start();
console.log("🚀 Telegram бот успішно запущений локально!");
/**
 * webserver.ts
 */
import { Application, Context, Router } from "./deps.ts";

const app = new Application();
const router = new Router();

const WRITE_MEMORY_API = Deno.env.get("WRITE_MEMORY_API");

router.get("/status", (context: Context) => {
  context.response.body = "Healthy";
});

router.post("/api/v1/debug/writeMemory", (context: Context) => {
  const address = context.request.url.searchParams.get("address");
  const value = context.request.url.searchParams.get("value");

  console.log("Writing " + address + "=" + value);
});

router.post("/api/v1/execute", async (context: Context) => {
  const result = context.request.body();
  const value = await result.value;

  // Push PC high byte
  value["state"]["stackPointer"] = (value["state"]["stackPointer"] - 1) & 0xFFFF;
  const highBytePush = fetch(`${WRITE_MEMORY_API}?id=${value["id"]}&address=${value["state"]["stackPointer"]}&value=${value["state"]["programCounter"] >> 8}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

  // Push PC low byte
  value["state"]["stackPointer"] = (value["state"]["stackPointer"] - 1) & 0xFFFF;
  const lowBytePush = fetch(`${WRITE_MEMORY_API}?id=${value["id"]}&address=${value["state"]["stackPointer"]}&value=${value["state"]["programCounter"] & 0xFF}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

  await Promise.all([highBytePush, lowBytePush]);

  switch (value["opcode"]) {
    case 0xC7: // RST 0
      value["state"]["programCounter"] = 0x00;
      break;
    case 0xCF: // RST 1
      value["state"]["programCounter"] = 0x08;
      break;
    case 0xD7: // RST 2
      value["state"]["programCounter"] = 0x10;
      break;
    case 0xDF: // RST 3
      value["state"]["programCounter"] = 0x18;
      break;
    case 0xE7: // RST 4
      value["state"]["programCounter"] = 0x20;
      break;
    case 0xEF: // RST 5
      value["state"]["programCounter"] = 0x28;
      break;
    case 0xF7: // RST 6
      value["state"]["programCounter"] = 0x30;
      break;
    case 0xFF: // RST 7
      value["state"]["programCounter"] = 0x38;
      break;
    default:
      context.response.status = 400;
      context.response.body = "Invalid opcode";
      return;
  }
  
  value["state"]["cycles"] += 11;

  context.response.status = 200;
  context.response.type = "application/json";
  context.response.body = JSON.stringify(value);
});

app.use(router.routes());

await app.listen("0.0.0.0:8080");
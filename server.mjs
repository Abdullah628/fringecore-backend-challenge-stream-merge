import net from "node:net";
import fs from "fs";
import path from "path";

const server = net.createServer();
const DELAY = 100;

server.on("connection", (conn) => {
  conn.write("WELCOME TO THE CHALLENGE.\n");
  conn.write("Press any key to start (Except the power button) \n");

  async function sendData() {
    try {
      const items = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "data.json"), "utf-8")
      );

      const indexCounts = new Map();
      let lastCompleteTime = Date.now();

      for (const item of items) {
        const message =
          JSON.stringify({
            type: item.type,
            data: item.data,
          }) + "\n";

        conn.write(message);

        const count = (indexCounts.get(item.index) || 0) + 1;
        indexCounts.set(item.index, count);

        if (count === 3) {
          const now = Date.now();
          const elapsed = now - lastCompleteTime;
          console.log(
            `Completed index ${item.index} - Time since last complete: ${elapsed}ms`
          );
          lastCompleteTime = now;
        }

        await new Promise((accept) => setTimeout(accept, DELAY));
      }

      conn.end();
      conn.destroy();
    } catch (error) {
      console.error(error);
    }
  }

  conn.on("data", (data) => {
    const _ = data.readUInt8(0);
    sendData();
  });

  conn.on("close", () => console.log("closed"));

  conn.on("error", (error) => {
    console.error(error);
  });
});

const port = parseInt(process.env.PORT ?? "3032");

server.listen(port, () => {
  console.log(`STARTED SERVER 0.0.0.0:${port}`);
});

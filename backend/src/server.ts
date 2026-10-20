import app from "./app";
import { env } from "./env";

const port = env().PORT;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));

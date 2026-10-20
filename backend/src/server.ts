import app from "./app";
import { listenPort } from "./env";

const port = listenPort();
app.listen(port, () => console.log(`API listening on port ${port}`));

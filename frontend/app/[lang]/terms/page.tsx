import { staticMetadata, staticPage } from "@/components/site/StaticPage";

export const dynamic = "force-dynamic";
export const generateMetadata = staticMetadata("terms");
export default staticPage("terms");

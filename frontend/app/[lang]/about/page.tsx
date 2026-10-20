import { staticMetadata, staticPage } from "@/components/site/StaticPage";

export const dynamic = "force-dynamic";
export const generateMetadata = staticMetadata("about");
export default staticPage("about");

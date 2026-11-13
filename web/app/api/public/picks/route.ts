// PickLab's picks for the browser. Its own handler (not the plain proxy to the API the analytics use) because on a
// site where PickLab is by invitation only a signed-in, invited account may read it: lib/server/picklab.ts decides.
import { picklabData } from "@/lib/server/picklab";

export const dynamic = "force-dynamic";
export const GET = (req: Request) => picklabData(req, "/picks");

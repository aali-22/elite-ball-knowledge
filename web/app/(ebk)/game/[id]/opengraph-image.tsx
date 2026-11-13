// The card a link to this game shows when it is shared (lib/share-image): the two team names, the game's lead
// finding and the model's win share. Drawn per request; with no game or no API it is the site's plain card.
import { SHARE_SIZE, gameImage } from "@/lib/share-image";

export const alt = "The two teams, the finding that decides the game and the model's win share";
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  return gameImage((await params).id);
}

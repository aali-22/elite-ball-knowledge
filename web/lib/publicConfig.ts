// Settings for the PickLab section: the responsible-gambling lines in its footer and the age it asks visitors to confirm.

/** Responsible-gambling lines shown in the footer of every PickLab page. */
export const HELP = [
  { region: "US", text: "Gambling problem? Call 1-800-GAMBLER." },
  { region: "Ontario", text: "ConnexOntario: 1-866-531-2600." },
];

export const MIN_AGE = 21; // the strictest US age; 19 in most of Canada, 18 in Quebec, Alberta and Manitoba

export const AGE_KEY = "picklab-public-age-ok";

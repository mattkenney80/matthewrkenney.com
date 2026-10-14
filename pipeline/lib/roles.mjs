// One place that decides how a TMDB crew job becomes a site Role.
export const JOB_ROLE = {
  Director: "director",
  "Director of Photography": "cinematographer",
  Editor: "editor",
  "Original Music Composer": "composer",
  Composer: "composer",
  Screenplay: "writer",
  Writer: "writer",
  Story: "writer",
  "Original Story": "writer",
  Novel: "writer",
  Author: "writer",
  Characters: "writer",
  Adaptation: "writer",
  Screenstory: "writer",
  "Short Story": "writer",
  Book: "writer",
  Teleplay: "writer",
  Producer: "producer",
};

export const NODE_ROLES = ["director", "cinematographer", "editor", "composer", "writer", "actor"];

export const crewRole = (c) => JOB_ROLE[c.job] ?? null;

// Jobs that look like a key role but did not map. Used only for the report.
const LOOKS_KEY = /photograph|cinemat|edit|compos|music|writ|screen|story|novel|author|book|direct|produc/i;
const NOISE = /assistant|associate|co-|line produc|supervis|coordinator|second unit|casting|art direct|production design|sound edit|dialogue edit|visual effects|color|colour|additional|trainee|intern|office/i;
const KEY_DEPTS = new Set(["Directing", "Writing", "Camera", "Editing", "Production", "Sound"]);
const SOUND_KEY = /music|compos/i;
export function unmappedKeyJob(c) {
  if (crewRole(c)) return false;
  if (!KEY_DEPTS.has(c.department)) return false;
  if (c.department === "Sound" && !SOUND_KEY.test(c.job)) return false;
  if (c.department === "Sound" && /editor|mixer|musician/i.test(c.job)) return false;
  return LOOKS_KEY.test(c.job) && !NOISE.test(c.job);
}

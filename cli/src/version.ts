declare const __VERSION__: string;
declare const __GIT_COMMIT__: string;

export const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev";
export const GIT_COMMIT = typeof __GIT_COMMIT__ !== "undefined" ? __GIT_COMMIT__ : "dev";

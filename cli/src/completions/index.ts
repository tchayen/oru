export { resolveDynamic } from "./dynamic.js";
export { generateBashCompletions } from "./bash.js";
export { generateZshCompletions } from "./zsh.js";
export { generateFishCompletions } from "./fish.js";
export {
  detectShell,
  getInstallPaths,
  installCompletions,
  confirm,
  formatSuccessMessage,
} from "./install.js";

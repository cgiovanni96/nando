export function replaceImageTag(env, imageTag) {
  const lines = (env ?? "").split(/\r?\n/);
  const kept = lines.filter((line) => !line.trimStart().startsWith("IMAGE_TAG="));

  while (kept.length > 0 && kept[kept.length - 1].trim() === "") {
    kept.pop();
  }

  kept.push(`IMAGE_TAG=${imageTag}`);

  return `${kept.join("\n")}\n`;
}

export function htmlToPlainText(value) {
  if (typeof value !== "string" || !value) return "";

  const parser = new DOMParser();
  const document = parser.parseFromString(value, "text/html");
  document.querySelectorAll("script, style, iframe, object, embed").forEach((element) => element.remove());
  document.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  document.querySelectorAll("p").forEach((element) => element.append("\n"));

  return (document.body.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getYoutubeEmbedUrl(trailer) {
  if (trailer?.site?.toLowerCase() !== "youtube") return null;
  const id = typeof trailer.id === "string" ? trailer.id.trim() : "";
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? `https://www.youtube.com/embed/${id}` : null;
}

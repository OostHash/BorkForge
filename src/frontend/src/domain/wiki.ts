/** Warframe wiki search link for an item, like the current app. */
export function wikiUrl(name: string): string {
  return `https://wiki.warframe.com/w/Special:Search?search=${encodeURIComponent(name)}`;
}

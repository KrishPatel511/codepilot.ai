export function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function initialsFrom(name: string) {
  return name.slice(0, 2).toUpperCase();
}

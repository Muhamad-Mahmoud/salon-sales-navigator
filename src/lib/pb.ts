import PocketBase from "pocketbase";

/**
 * Singleton PocketBase client instance.
 * Synchronizes authStore with document.cookie for rock-solid persistence
 * across page reloads, browser restarts, and tab switches.
 */
const pbUrl =
  import.meta.env.VITE_PB_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8090");

export const pb = new PocketBase(pbUrl);

// Dual-persistence: localStorage + cookie
if (typeof document !== "undefined") {
  // If localStorage is empty/invalid but cookie has valid auth, restore it
  if (!pb.authStore.isValid && document.cookie.includes("pb_auth")) {
    pb.authStore.loadFromCookie(document.cookie);
  }

  // Keep cookie in sync whenever authStore changes (login, refresh, logout)
  pb.authStore.onChange((token) => {
    if (token && pb.authStore.isValid) {
      document.cookie = pb.authStore.exportToCookie({
        httpOnly: false,
        sameSite: "Lax",
        secure: window.location.protocol === "https:",
        path: "/",
      });
    } else {
      document.cookie = "pb_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax;";
    }
  });
}

export default pb;

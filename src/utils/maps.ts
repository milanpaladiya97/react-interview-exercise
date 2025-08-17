// export const googleMapsKey = "AIzaSyA6ybJwxJZgd0t91Xx_QEr_4FU5hph0ifM"

export function getGoogleMapsKey(): string | null {
  if (typeof import.meta !== "undefined" && (import.meta as any).env && (import.meta as any).env.VITE_MAPS_API_KEY) {
    return (import.meta as any).env.VITE_MAPS_API_KEY;
  }

  // fallback null
  return null;
}
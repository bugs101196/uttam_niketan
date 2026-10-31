// School contact details shown on the public website (supplied by the school).
export const schoolPhones = [
  { display: "90979 77171", tel: "+919097977171" },
  { display: "83407 55682", tel: "+918340755682" },
] as const;

// Location from the school's Google Maps listing.
const latLng = "25.5961582,85.494884";
export const schoolMap = {
  embedUrl: `https://maps.google.com/maps?q=${latLng}&z=16&output=embed`,
  // Opens the school's listing (reviews, photos) in Google Maps.
  listingUrl: "https://www.google.com/maps/search/?api=1&query=Uttam+Niketan+school+deshrajpur+mahnar+vaishali",
  directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${latLng}`,
};

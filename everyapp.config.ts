import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "app-requests",
  name: "App Requests",
  description:
    "Ask for web apps to be built, follow the shared build queue, and browse finished apps to install.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
  },
});

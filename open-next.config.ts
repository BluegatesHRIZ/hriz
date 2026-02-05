import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Explicitly tell OpenNext that we're using Node.js runtime
  // Cloudflare Workers with nodejs_compat flag will handle this
  default: {
    override: {
      wrapper: "cloudflare-node",
    },
  },
});

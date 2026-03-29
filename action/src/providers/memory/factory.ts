import type { GitHub } from "@actions/github/lib/utils.js";
import type { ActionConfig, MemoryProvider } from "../../types.js";
import { NoneMemoryProvider } from "./none.js";
import { GitNativeMemoryProvider } from "./git-native.js";
import { QdrantMemoryProvider } from "./qdrant.js";

type Octokit = InstanceType<typeof GitHub>;

interface MemoryFactoryOptions {
  config: ActionConfig;
  octokit: Octokit;
  owner: string;
  repo: string;
}

export function createMemoryProvider(options: MemoryFactoryOptions): MemoryProvider {
  switch (options.config.memoryProvider) {
    case "none":
      return new NoneMemoryProvider();

    case "git-native":
      return new GitNativeMemoryProvider({
        octokit: options.octokit,
        owner: options.owner,
        repo: options.repo,
        historyDepth: options.config.historyDepth,
      });

    case "qdrant":
      if (!options.config.vectorStoreUrl) {
        throw new Error(
          "mergelore: qdrant provider requires vector-store-url. Set it to your Qdrant instance URL.",
        );
      }
      return new QdrantMemoryProvider({
        vectorStoreUrl: options.config.vectorStoreUrl,
        apiKey: options.config.qdrantApiKey,
        octokit: options.octokit,
        owner: options.owner,
        repo: options.repo,
        historyDepth: options.config.historyDepth,
      });

    default: {
      const exhaustive: never = options.config.memoryProvider;
      throw new Error(
        `mergelore: Unknown memory provider "${exhaustive}". Valid options: none, git-native, qdrant`,
      );
    }
  }
}

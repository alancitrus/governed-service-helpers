import { fs, path, shell } from "./deps.ts";

export interface ModuleVersionSupplier<O> {
  (importMetaURL: string, options?: O): Promise<string>;
}

export interface DetermineVersionFromRepoTagOptions {
  readonly repoIdentity?: string;
  readonly onInvalidLocalVersion?: (
    execResult: shell.RunShellCommandExecResult,
  ) => string;
  readonly onInvalidRemoteMatch?: (repoVersionRegExp: RegExp) => string;
}

export async function determineVersionFromRepoTag(
  importMetaURL: string,
  options?: DetermineVersionFromRepoTagOptions,
): Promise<string> {
  // if we're running locally, see if Git tag can be discovered
  if (fs.existsSync(path.fromFileUrl(importMetaURL))) {
    let version = "v0.0.0";
    await shell.runShellCommand(
      "git describe --tags --abbrev=0",
      {
        onCmdComplete: (execResult) => {
          if (execResult.code == 0) {
            version = new TextDecoder().decode(execResult.stdOut).trim();
          } else {
            if (options?.onInvalidLocalVersion) {
              version = options.onInvalidLocalVersion(execResult);
            } else {
              version = `v?.?.${execResult.code}`;
            }
          }
        },
      },
    );
    return `${version}-local`;
  }

  // if we're running remote, get the version from the URL in the format
  // *repoIdentity/vX.Y.Z/* or */vX.Y.Z/* if repoIdentity not supplied
  const repoVersionRegExp = options?.repoIdentity
    ? new RegExp(
      `${options.repoIdentity}\/v?(?<version>\d+\.\d+\.\d+)\/`,
    )
    : /\/v?(?<version>\d+\.\d+\.\d+)\//;
  const matched = importMetaURL.match(repoVersionRegExp);
  if (matched) {
    return `v${matched.groups!["version"]}`;
  }
  if (options?.onInvalidRemoteMatch) {
    return options.onInvalidRemoteMatch(repoVersionRegExp);
  }
  return `v0.0.0-remote(no match for ${repoVersionRegExp} in '${importMetaURL}')`;
}

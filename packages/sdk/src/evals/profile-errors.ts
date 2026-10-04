import { PROFILE_LIMITS } from "@sphynx/schema/domain/harness-profile";
import { Data } from "effect";

export class ProfileDirectoryUnreadable extends Data.TaggedError(
  "ProfileDirectoryUnreadable"
)<{ readonly cause: unknown; readonly dir: string }> {
  override get message() {
    return `Could not read the profile directory ${this.dir}`;
  }
}

export class ProfilePathInvalid extends Data.TaggedError("ProfilePathInvalid")<{
  readonly path: string;
}> {
  override get message() {
    return `${this.path} cannot be shipped: a profile file sits under home/ or workspace/ without a .. segment`;
  }
}

export class ProfileFileTooLarge extends Data.TaggedError(
  "ProfileFileTooLarge"
)<{ readonly chars: number; readonly path: string }> {
  override get message() {
    return `${this.path} is ${this.chars} characters; a profile file holds at most ${PROFILE_LIMITS.fileChars}`;
  }
}

export class ProfileTooLarge extends Data.TaggedError("ProfileTooLarge")<{
  readonly chars: number;
}> {
  override get message() {
    return `The profile's files hold ${this.chars} characters; at most ${PROFILE_LIMITS.totalChars} fit`;
  }
}

export class ProfileTooManyFiles extends Data.TaggedError(
  "ProfileTooManyFiles"
)<{ readonly count: number; readonly largest: readonly string[] }> {
  override get message() {
    return `The profile has ${this.count} files; at most ${PROFILE_LIMITS.files} fit. Biggest folders: ${this.largest.join(", ")}. Add what you do not need to a .gitignore`;
  }
}

export class ProfileManifestInvalid extends Data.TaggedError(
  "ProfileManifestInvalid"
)<{ readonly dir: string; readonly reason: string }> {
  override get message() {
    return `${this.dir}/profile.json is not a profile manifest: ${this.reason}`;
  }
}

export class ProfileManifestOutside extends Data.TaggedError(
  "ProfileManifestOutside"
)<{ readonly dir: string; readonly value: string }> {
  override get message() {
    return `${this.value} in ${this.dir}/profile.json names a file outside the profile`;
  }
}

export class CommandProfileNeedsRun extends Data.TaggedError(
  "CommandProfileNeedsRun"
)<{ readonly name: string }> {
  override get message() {
    return `Profile ${this.name} runs on the command harness, so its profile.json needs a run command`;
  }
}

export class ProfileStepNotSupported extends Data.TaggedError(
  "ProfileStepNotSupported"
)<{ readonly base: string; readonly step: "install" | "run" }> {
  override get message() {
    return `Only the command harness takes a ${this.step} step; ${this.base} does not`;
  }
}

import { FSModule } from "browserfs/dist/node/core/FS";
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import * as path from "path";
import PouchDB from "pouchdb";
import PouchdbFind from "pouchdb-find";
import { randomID } from "../utilities/utils";
import Stats from "browserfs/dist/node/core/node_fs_stats";
import { getHeaderFromMarkdown } from "../utilities/note";

export interface Notebook {
  _id: string;
  dir: string;
  name: string;

  // git
  gitURL: string;
  gitBranch: string;
  gitCorsProxy?: string;
  gitUsername?: string;
  gitPassword?: string;
}

export interface Note {
  notebook: Notebook;
  filePath: string;
  title: string;
  markdown: string;
  config: NoteConfig;
  // createdAt: Date; // <- Can't get modifiedAt time
}

export interface Directory {
  name: string;
  path: string;
  children?: Directory[];
}

export interface NoteConfig {
  id?: string;
  createdAt: Date;
  modifiedAt: Date;
  tags?: string[];
}

export interface NotebookConfig {
  repository: string;
  branch: string;
  author: string;
  contributors: string[];
}

interface CrossnoteConstructorProps {
  fs: FSModule;
}
interface CloneNotebookArgs {
  name?: string;
  corsProxy?: string;
  gitURL: string;
  branch?: string;
  depth?: number;
  username?: string;
  password?: string;
  rememberCredentials?: boolean;
}

interface ListNotesArgs {
  notebook: Notebook;
  dir: string;
  includeSubdirectories?: Boolean;
}
export interface PushNotebookArgs {
  notebook: Notebook;
  authorName?: string;
  authorEmail?: string;
  username?: string;
  password?: string;
  message?: string;
  onProgress?: (progress: git.GitProgressEvent) => void;
  onMessage?: (message: string) => void;
  onAuthFailure?: (url: string) => void;
  onAuthSuccess?: (url: string) => void;
}

export interface PullNotebookArgs {
  notebook: Notebook;
  onProgress?: (progress: git.GitProgressEvent) => void;
  onMessage?: (message: string) => void;
  onAuthFailure?: (url: string) => void;
  onAuthSuccess?: (url: string) => void;
}

export default class Crossnote {
  private fs: FSModule;

  private readFile: (path: string) => Promise<string>;
  private writeFile: (path: string, data: string) => Promise<void>;
  private readdir: (path: string) => Promise<string[]>;
  private unlink: (path: string) => Promise<void>;
  private stats: (path: string) => Promise<Stats>;
  private mkdir: (path: string) => Promise<void>;
  private exists: (path: string) => Promise<boolean>;
  private rename: (oldPath: string, newPath: string) => Promise<void>;
  private rmdir: (path: string) => Promise<void>;

  private notebookDB: PouchDB.Database<Notebook>;

  constructor(props: CrossnoteConstructorProps) {
    this.fs = props.fs;
    this.setUpFSMethods();

    PouchDB.plugin(PouchdbFind);
    this.notebookDB = new PouchDB("notebooks");
    this.notebookDB.createIndex({
      index: {
        fields: ["gitURL"]
      }
    });
  }

  private setUpFSMethods() {
    this.readFile = (path: string) => {
      return new Promise((resolve, reject) => {
        this.fs.readFile(path, (error, data) => {
          if (error) {
            return reject(error);
          } else {
            return resolve(data.toString());
          }
        });
      });
    };
    this.writeFile = (path: string, data: string) => {
      return new Promise((resolve, reject) => {
        this.fs.writeFile(path, data, { encoding: "utf8" }, error => {
          if (error) {
            return reject(error);
          } else {
            return resolve();
          }
        });
      });
    };
    this.readdir = (path: string) => {
      return new Promise((resolve, reject) => {
        this.fs.readdir(path, (error, files) => {
          if (error) {
            return reject(error);
          } else {
            return resolve(files);
          }
        });
      });
    };
    this.unlink = (path: string) => {
      return new Promise((resolve, reject) => {
        this.fs.unlink(path, error => {
          if (error) {
            return reject(error);
          } else {
            return resolve();
          }
        });
      });
    };
    this.stats = (path: string) => {
      return new Promise((resolve, reject) => {
        this.fs.stat(path, (error, stats) => {
          if (error) {
            return reject(error);
          } else {
            return resolve(stats);
          }
        });
      });
    };
    this.mkdir = (path: string) => {
      return new Promise((resolve, reject) => {
        this.fs.mkdir(path, "0777", error => {
          if (error) {
            return reject(error);
          } else {
            return resolve();
          }
        });
      });
    };
    this.exists = (path: string) => {
      return new Promise((resolve, reject) => {
        this.fs.exists(path, exists => {
          return resolve(exists);
        });
      });
    };
    this.rename = (oldPath: string, newPath: string) => {
      return new Promise((resolve, reject) => {
        this.fs.rename(oldPath, newPath, error => {
          if (error) {
            return reject(error);
          } else {
            return resolve();
          }
        });
      });
    };

    const rmdir = (path: string) => {
      return new Promise((resolve, reject) => {
        this.fs.rmdir(path, error => {
          if (error) {
            return reject(error);
          } else {
            return resolve();
          }
        });
      });
    };
    // Remove the directory recursively
    this.rmdir = async (dirPath: string) => {
      const files = await this.readdir(dirPath);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = path.resolve(dirPath, file);
        const stats = await this.stats(filePath);
        if (stats.isDirectory()) {
          await this.rmdir(filePath);
        } else {
          await this.unlink(filePath);
        }
      }

      await rmdir(dirPath);
    };
  }

  public async addNotebook({
    name = "",
    corsProxy,
    gitURL,
    branch = "master",
    username = "",
    password = "",
    depth = 3,
    rememberCredentials = false
  }: CloneNotebookArgs) {
    if (gitURL) {
      return await this.cloneNotebook({
        name,
        corsProxy,
        gitURL,
        branch,
        username,
        password,
        depth,
        rememberCredentials
      });
    } else {
      const _id = randomID();
      const dir = `/notebooks/${_id}`;
      const notebook: Notebook = {
        _id,
        dir,
        name: name.trim() || "Unnamed",
        gitURL: gitURL.trim(),
        gitBranch: branch.trim(),
        gitCorsProxy: corsProxy.trim(),
        gitUsername: rememberCredentials ? username.trim() : "",
        gitPassword: rememberCredentials ? password : ""
      };
      if (!(await this.exists("/notebooks"))) {
        await this.mkdir("/notebooks");
      }
      if (!(await this.exists(dir))) {
        await this.mkdir(dir);
      }
      await git.init({
        fs: this.fs,
        dir
      });

      // Save to DB
      try {
        await this.notebookDB.put(notebook);
      } catch (error) {
        // Failed to save to DB
        await this.rmdir(dir);
      }

      return notebook;
    }
  }

  public async cloneNotebook({
    name = "",
    corsProxy,
    gitURL,
    branch = "master",
    username = "",
    password = "",
    depth = 10,
    rememberCredentials = false
  }: CloneNotebookArgs): Promise<Notebook> {
    if (!gitURL.match(/^https?:\/\//)) {
      throw new Error("error/invalid-git-url-prefix");
    }

    // Check if gitURL exists
    /*
    let exists = false;
    try {
      const notebooks = await this.notebookDB.find({
        selector: {
          gitURL: { $eq: gitURL }
        }
      });
      if (notebooks.docs && notebooks.docs.length) {
        exists = true;
      }
    } catch (error) {
      exists = false;
    }

    if (exists) {
      throw new Error("error/repository-already-cloned");
    }*/

    const _id = randomID();
    const dir = `/notebooks/${_id}`;

    await git.clone({
      fs: this.fs,
      http,
      dir,
      corsProxy,
      url: gitURL,
      ref: branch,
      depth: depth,
      singleBranch: true,
      onAuth: (url, auth) => {
        return {
          username,
          password
        };
      }
    });

    const notebook: Notebook = {
      _id,
      dir,
      name: name || this.getDefaultNotebookNameFromGitURL(gitURL),
      gitURL: gitURL,
      gitBranch: branch,
      gitCorsProxy: corsProxy,
      gitUsername: rememberCredentials ? username : "",
      gitPassword: rememberCredentials ? password : ""
    };

    // Save to DB
    try {
      await this.notebookDB.put(notebook);
    } catch (error) {
      // Failed to save to DB
      await this.rmdir(dir);
    }

    return notebook;
  }

  public async exportNotebookToJSON(notebook: Notebook): Promise<string> {
    return "";
  }

  public async importNotebookFromJSON(notebook: Notebook): Promise<string> {
    return "";
  }

  public async deleteNotebook(notebookID: string) {
    const notebook = await this.notebookDB.get(notebookID);
    await this.rmdir(notebook.dir);
    await this.notebookDB.remove(notebook);
  }
  public async updateNotebook(notebook: Notebook) {
    await this.notebookDB.put(notebook);
  }
  /*
  public async makeDirectoryForNotebook(notebook: Notebook, dir: string) {
    await this.mkdir(path.resolve(notebook.dir, dir));
  }
  public async removeDirectoryForNotebook(notebook: Notebook, dir: string) {
    const notes = await this.listNotes({
      notebook,
      dir,
      includeSubdirectories: true
    });
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      await this.deleteNote(notebook, note.filePath);
    }
    await this.unlink(path.resolve(notebook.dir, dir));
  }
  */

  public async changeNoteFilePath(
    notebook: Notebook,
    note: Note,
    newFilePath: string
  ) {
    newFilePath = newFilePath.replace(/^\/+/, "");
    if (!newFilePath.endsWith(".md")) {
      newFilePath = newFilePath + ".md";
    }

    try {
      await git.remove({
        fs: this.fs,
        dir: notebook.dir,
        filepath: note.filePath
      });
    } catch (error) {}

    const newDirPath = path.dirname(path.resolve(notebook.dir, newFilePath));
    // Make directories recursively
    const dirNames = newDirPath.split("/").slice(1);
    for (let i = 0; i < dirNames.length; i++) {
      const paths = ["/"];
      for (let j = 0; j <= i; j++) {
        paths.push(dirNames[j]);
      }
      if (!(await this.exists(paths.join("/")))) {
        await this.mkdir(paths.join("/"));
      }
    }
    await this.rename(
      path.resolve(notebook.dir, note.filePath),
      path.resolve(notebook.dir, newFilePath)
    );
    await git.add({
      fs: this.fs,
      dir: notebook.dir,
      filepath: newFilePath
    });
  }

  public async pushNotebook({
    notebook,
    authorName = "crossnote",
    authorEmail = "anonymous@crossnote.com",
    username,
    password,
    message = "doc: Updated docs",
    onProgress,
    onMessage,
    onAuthFailure,
    onAuthSuccess
  }: PushNotebookArgs): Promise<null | git.PushResult> {
    const stagedFiles = await this.listFiles(notebook);
    if (!stagedFiles.length) {
      return {
        ok: true,
        error: null,
        refs: {}
      };
    }
    const sha = await git.commit({
      fs: this.fs,
      dir: notebook.dir,
      author: {
        name: authorName,
        email: authorEmail
      },
      message
    });
    // console.log(sha);
    const pushResult = await git.push({
      fs: this.fs,
      http,
      onAuth: (url, auth) => {
        return {
          username: username, // || notebook.gitUsername,
          password: password // || notebook.gitPassword
        };
      },
      onProgress: progress => {
        if (onProgress) {
          onProgress(progress);
        }
      },
      onMessage: message => {
        if (onMessage) {
          onMessage(message);
        }
      },
      onAuthFailure: (url, auth) => {
        if (onAuthFailure) {
          onAuthFailure(url);
        }
      },
      onAuthSuccess: (url, auth) => {
        if (onAuthSuccess) {
          onAuthSuccess(url);
        }
      },
      url: notebook.gitURL,
      dir: notebook.dir,
      ref: notebook.gitBranch,
      corsProxy: notebook.gitCorsProxy
    });
    if (pushResult.ok) {
      // Unstage all files
      for (let i = 0; i < stagedFiles.length; i++) {
        await git.remove({
          fs: this.fs,
          dir: notebook.dir,
          filepath: stagedFiles[i]
        });
      }
    }
    return pushResult;
  }

  public async pullNotebook({
    notebook,
    onProgress,
    onAuthFailure,
    onAuthSuccess,
    onMessage
  }: PullNotebookArgs) {
    await git.pull({
      fs: this.fs,
      http,
      dir: notebook.dir,
      singleBranch: true,
      corsProxy: notebook.gitCorsProxy,
      ref: notebook.gitBranch,
      author: {
        name: "anonymous",
        email: "anonymous@crossnote.app"
      },
      onAuth: (url, auth) => {
        return {
          username: notebook.gitUsername,
          password: notebook.gitPassword
        };
      },
      onProgress,
      onAuthFailure,
      onAuthSuccess,
      onMessage
    });
  }

  public async checkoutNote(note: Note): Promise<Note> {
    try {
      await git.checkout({
        fs: this.fs,
        dir: note.notebook.dir,
        // ref: "HEAD"
        // ref: note.notebook.gitBranch,
        filepaths: [note.filePath]
      });
      await git.remove({
        fs: this.fs,
        dir: note.notebook.dir,
        filepath: note.filePath
      });
      const newNote = await this.getNote(note.notebook, note.filePath);
      return newNote;
    } catch (error) {
      return null;
    }
  }

  public async listNotebooks(): Promise<Notebook[]> {
    const notebooks = (
      await this.notebookDB.find({
        selector: {
          gitURL: { $gt: null }
        }
      })
    ).docs;
    // console.log(notebooks);
    return notebooks;
  }

  public async listFiles(notebook: Notebook) {
    return await git.listFiles({
      fs: this.fs,
      dir: notebook.dir
    });
  }

  private async getNote(
    notebook: Notebook,
    filePath: string,
    stats?: Stats
  ): Promise<Note> {
    const absFilePath = path.resolve(notebook.dir, filePath);
    if (!stats) {
      try {
        stats = await this.stats(absFilePath);
      } catch (error) {
        return null;
      }
    }
    if (stats.isFile() && filePath.endsWith(".md")) {
      let markdown = await this.readFile(absFilePath);
      // console.log("read: ", filePath, markdown);

      // Read the noteConfig, which is like <!-- note {...} --> at the end of the markdown file
      let noteConfig: NoteConfig = {
        id: "",
        createdAt: stats.mtime,
        modifiedAt: stats.mtime,
        tags: []
      };
      const lines = markdown
        .trim()
        .split("\n")
        .filter(x => x.length > 0);
      const lastLine = lines[lines.length - 1].trim();
      if (lastLine.match(/^<!--\s*note\s+/)) {
        markdown = lines.slice(0, lines.length - 1).join("\n");
        const configStr = lines[lines.length - 1]
          .replace(/^<!--\s*note\s+/, "")
          .replace(/\s*-->$/, "");
        let config: any = {};
        try {
          config = JSON.parse(configStr);
          config.modifiedAt = new Date(config.modifiedAt || stats.mtime);
          config.createdAt = new Date(config.createdAt || stats.mtime);
        } catch (error) {}
        noteConfig = Object.assign(noteConfig, config);
      }

      // Create note
      const note: Note = {
        notebook: notebook,
        filePath: path.relative(notebook.dir, absFilePath),
        title: getHeaderFromMarkdown(markdown),
        markdown,
        config: noteConfig
      };
      return note;
    } else {
      return null;
    }
  }

  public async listNotes({
    notebook,
    dir = "./",
    includeSubdirectories = false
  }: ListNotesArgs): Promise<Note[]> {
    let notes: Note[] = [];
    let files: string[] = [];
    try {
      files = await this.readdir(path.resolve(notebook.dir, dir));
    } catch (error) {
      files = [];
    }
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const absFilePath = path.resolve(notebook.dir, dir, file);
      const stats = await this.stats(absFilePath);
      const note = await this.getNote(
        notebook,
        path.relative(notebook.dir, absFilePath),
        stats
      );
      if (note) {
        notes.push(note);
      }

      if (stats.isDirectory() && file !== ".git" && includeSubdirectories) {
        notes = notes.concat(
          await this.listNotes({
            notebook,
            dir: path.relative(notebook.dir, absFilePath),
            includeSubdirectories
          })
        );
      }
    }

    // console.log("listNotes: ", notes);
    return notes;
  }
  public async writeNote(
    notebook: Notebook,
    filePath: string,
    markdown: string,
    noteConfig: NoteConfig
  ) {
    noteConfig.modifiedAt = new Date();
    await this.writeFile(
      path.resolve(notebook.dir, filePath),
      markdown + `\n\n<!-- note ${JSON.stringify(noteConfig)}-->`
    );
    await git.add({
      fs: this.fs,
      dir: notebook.dir,
      filepath: filePath
    });
  }
  public async deleteNote(notebook: Notebook, filePath: string) {
    if (await this.exists(path.resolve(notebook.dir, filePath))) {
      await git.remove({
        fs: this.fs,
        dir: notebook.dir,
        filepath: filePath
      });
      await this.unlink(path.resolve(notebook.dir, filePath));
    }
  }

  // public async moveNote(fromFilePath: string, toFilePath: string) {}
  public async getNotebookDirectoriesFromNotes(
    notes: Note[]
  ): Promise<Directory> {
    const rootDirectory: Directory = {
      name: ".",
      path: ".",
      children: []
    };

    const filePaths = new Set<string>([]);
    for (let i = 0; i < notes.length; i++) {
      filePaths.add(path.dirname(notes[i].filePath));
    }

    filePaths.forEach(value => {
      const dirNames = value.split("/");
      let directory = rootDirectory;
      for (let i = 0; i < dirNames.length; i++) {
        if (dirNames[i] === ".") {
          break;
        } else {
          let subDirectory = directory.children.filter(
            directory => directory.name === dirNames[i]
          )[0];
          if (subDirectory) {
            directory = subDirectory;
          } else {
            let paths: string[] = [];
            for (let j = 0; j <= i; j++) {
              paths.push(dirNames[j]);
            }
            subDirectory = {
              name: dirNames[i],
              path: paths.join("/"),
              children: []
            };
            directory.children.push(subDirectory);
            directory = subDirectory;
          }
        }
      }
    });

    return rootDirectory;
  }

  private getDefaultNotebookNameFromGitURL(gitURL: string) {
    const i = gitURL.lastIndexOf("/");
    return gitURL.slice(i + 1).replace(/\.git/, "");
  }

  public async getStatus(note: Note) {
    return await git.status({
      fs: this.fs,
      dir: note.notebook.dir,
      filepath: note.filePath
    });
  }
}

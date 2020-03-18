import { useState, useEffect, useCallback } from "react";
import { createContainer } from "unstated-next";
import * as path from "path";
import Noty from "noty";
import { randomID, OneDay } from "../utilities/utils";
import { useTranslation } from "react-i18next";
import Crossnote, {
  Notebook,
  Note,
  Directory,
  NoteConfig,
  PushNotebookArgs,
  PullNotebookArgs
} from "../lib/crossnote";

interface InitialState {
  crossnote: Crossnote;
}

function useCrossnoteContainer(initialState: InitialState) {
  const { t } = useTranslation();
  const crossnote = initialState.crossnote;
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook>(null);
  const [notebookNotes, setNotebookNotes] = useState<Note[]>([]);
  const [notebookDirectories, setNotebookDirectories] = useState<Directory>({
    name: ".",
    path: ".",
    children: []
  });
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note>(null);
  const [includeSubdirectories, setIncludeSubdirectories] = useState<boolean>(
    true
  );
  const [selectedDir, setSelectedDir] = useState<string>("$notes"); // $notes | $todau | $todo | real directory
  const [isAddingNotebook, setIsAddingNotebook] = useState<boolean>(false);
  const [isPushingNotebook, setIsPushingNotebook] = useState<boolean>(false);
  const [isPullingNotebook, setIsPullingNotebook] = useState<boolean>(false);
  const [displayMobileEditor, setDisplayMobileEditor] = useState<boolean>(
    false
  ); // For mobile device without any initial data, set to `true` will create empty white page.
  const updateNoteMarkdown = useCallback(
    (note: Note, markdown: string, callback?: (status: string) => void) => {
      setNotes(notes =>
        notes.map(n => {
          if (n.filePath === note.filePath) {
            n.markdown = markdown;
            //  n.config.modifiedAt = new Date();
            crossnote
              .writeNote(note.notebook, note.filePath, markdown, note.config)
              .then(() => {
                if (callback) {
                  crossnote.getStatus(note).then(status => {
                    callback(status);
                  });
                }
              });
            return n;
          } else {
            return n;
          }
        })
      );
    },
    [crossnote]
  );

  const deleteNote = useCallback(
    (note: Note) => {
      crossnote.deleteNote(selectedNotebook, note.filePath);
      setNotebookNotes(notes => {
        const newNotes = notes.filter(n => n.filePath !== note.filePath);
        if (newNotes.length !== notes.length) {
          setSelectedNote(newNotes[0]);
        }

        crossnote
          .getNotebookDirectoriesFromNotes(newNotes)
          .then(directories => {
            setNotebookDirectories(directories);
          });
        return newNotes;
      });
      setDisplayMobileEditor(false);
    },
    [crossnote, selectedNotebook]
  );

  const changeNoteFilePath = useCallback(
    (note: Note, newFilePath: string) => {
      (async () => {
        try {
          await crossnote.changeNoteFilePath(
            selectedNotebook,
            note,
            newFilePath
          );
          const newNotes = notebookNotes.map(n => {
            if (n.filePath === note.filePath) {
              n.filePath = newFilePath;
              n.config.modifiedAt = new Date();
              return n;
            } else {
              return n;
            }
          });
          setNotebookNotes(newNotes);
          setNotebookDirectories(
            await crossnote.getNotebookDirectoriesFromNotes(newNotes)
          );
        } catch (error) {
          new Noty({
            type: "error",
            text: "Failed to change file path",
            layout: "topRight",
            theme: "relax",
            timeout: 5000
          }).show();
        }
      })();
    },
    [selectedNotebook, crossnote, notebookNotes]
  );

  const createNewNote = useCallback(
    (fileName: string = "") => {
      (async () => {
        if (!fileName) {
          fileName = randomID();
        }
        if (!fileName.endsWith(".md")) {
          fileName = fileName + ".md";
        }
        let dir = selectedDir;
        let filePath;
        if (
          selectedDir === "$notes" ||
          selectedDir === "$today" ||
          selectedDir === "$todo"
        ) {
          filePath = fileName;
        } else {
          filePath = path.relative(
            selectedNotebook.dir,
            path.resolve(selectedNotebook.dir, dir, fileName)
          );
        }

        const noteConfig: NoteConfig = {
          id: "",
          tags: [],
          modifiedAt: new Date(),
          createdAt: new Date()
        };
        await crossnote.writeNote(selectedNotebook, filePath, "", noteConfig);
        const note: Note = {
          notebook: selectedNotebook,
          filePath: filePath,
          title: "",
          markdown: "",
          config: noteConfig
        };
        setNotebookNotes(notes => [note, ...notes]);
        setSelectedNote(note);
        setDisplayMobileEditor(true);
      })();
    },
    [selectedNotebook, crossnote, selectedDir]
  );

  const addNotebook = useCallback(
    async (
      name: string,
      gitURL: string,
      gitBranch: string,
      gitUsername: string,
      gitPassword: string,
      gitRememberCredentials: boolean,
      gitCorsProxy: string
    ) => {
      setIsAddingNotebook(true);
      try {
        const notebook = await crossnote.addNotebook({
          name,
          gitURL,
          branch: gitBranch,
          username: gitUsername,
          password: gitPassword,
          corsProxy: gitCorsProxy,
          rememberCredentials: gitRememberCredentials
        });
        setNotebooks(notebooks => [notebook, ...notebooks]);
        setIsAddingNotebook(false);
      } catch (error) {
        setIsAddingNotebook(false);
        throw error;
      }
    },
    [crossnote]
  );

  const updateNotebook = useCallback(
    async (notebook: Notebook) => {
      if (!crossnote) {
        return;
      }
      try {
        await crossnote.updateNotebook(notebook);
        setNotebooks(notebooks => [...notebooks]);
      } catch (error) {}
    },
    [crossnote]
  );

  const deleteNotebook = useCallback(
    async (notebook: Notebook) => {
      if (!crossnote) {
        return;
      }
      try {
        await crossnote.deleteNotebook(notebook._id);
      } catch (error) {}
      let selectedNotebook: Notebook = null;
      setNotebooks(notebooks =>
        notebooks.filter(n => {
          if (!selectedNotebook && n._id !== notebook._id) {
            selectedNotebook = n;
          }
          return n._id !== notebook._id;
        })
      );
      setSelectedNotebook(selectedNotebook);
    },
    [crossnote]
  );

  const pushNotebook = useCallback(
    async (args: PushNotebookArgs) => {
      if (!crossnote) {
        return;
      }
      setIsPushingNotebook(true);
      try {
        await crossnote.pushNotebook(args);
        setIsPushingNotebook(false);
      } catch (error) {
        setIsPushingNotebook(false);
        throw error;
      }
    },
    [crossnote]
  );

  const pullNotebook = useCallback(
    async (args: PullNotebookArgs) => {
      if (!crossnote) {
        return;
      }
      setIsPullingNotebook(true);
      try {
        await crossnote.pullNotebook(args);
        setIsPullingNotebook(false);
        const notes = (
          await crossnote.listNotes({
            notebook: args.notebook,
            dir: "./",
            includeSubdirectories: true
          })
        ).sort(
          (a, b) =>
            b.config.modifiedAt.getTime() - a.config.modifiedAt.getTime()
        );
        setNotebookNotes(notes);
        setNotebookDirectories(
          await crossnote.getNotebookDirectoriesFromNotes(notes)
        );
        if (!notes.find(n => n.filePath === selectedNote.filePath)) {
          setSelectedNote(notes[0]); // TODO: pull might remove currently selectedNote
        }
      } catch (error) {
        setIsPullingNotebook(false);
        throw error;
      }
    },
    [crossnote, selectedNote]
  );

  const checkoutNote = useCallback(
    async (note: Note) => {
      if (!crossnote) {
        return;
      }
      const newNote = await crossnote.checkoutNote(note);
      if (newNote) {
        setNotebookNotes(notes =>
          notes.map(n => {
            if (n.filePath === newNote.filePath) {
              return newNote;
            } else {
              return n;
            }
          })
        );
        setNotes(notes =>
          notes.map(n => {
            if (n.filePath === newNote.filePath) {
              return newNote;
            } else {
              return n;
            }
          })
        );
        setSelectedNote(newNote);
      } else {
        // The note is deleted after checkout
        setNotebookNotes(notes => {
          const newNotes = notes.filter(n => n.filePath !== note.filePath);
          crossnote
            .getNotebookDirectoriesFromNotes(newNotes)
            .then(directories => {
              setNotebookDirectories(directories);
            });
          return newNotes;
        });
        setNotes(notes => {
          const newNotes = notes.filter(n => n.filePath !== note.filePath);
          setSelectedNote(newNotes[0]);
          return newNotes;
        });
      }
    },
    [crossnote]
  );

  useEffect(() => {
    if (!crossnote) {
      return;
    }

    (async () => {
      const notebooks = await crossnote.listNotebooks();
      let notebook: Notebook = null;
      if (notebooks.length) {
        setNotebooks(notebooks);
        const selectedNotebookID = localStorage.getItem("selectedNotebookID");
        notebook = notebooks.find(n => n._id === selectedNotebookID);
        if (!notebook) {
          notebook = notebooks[0];
        }
        setSelectedNotebook(notebook); // TODO: <= default selected
      } else {
        /*
        notebook = await crossnote.cloneNotebook({
          corsProxy: "https://cors.isomorphic-git.org",
          gitURL: "https://github.com/0xGG/crossnote-doc.git"
        });
        */
        notebook = await crossnote.addNotebook({
          name: "Unamed",
          corsProxy: "https://cors.isomorphic-git.org",
          gitURL: ""
        });
        setNotebooks([notebook]);
        setSelectedNotebook(notebook);
      }
    })();
  }, [crossnote]);

  useEffect(() => {
    if (!crossnote) {
      return;
    }
    (async () => {
      const notes = (
        await crossnote.listNotes({
          notebook: selectedNotebook,
          dir: "./",
          includeSubdirectories: true
        })
      ).sort((a, b) => {
        return b.config.modifiedAt.getTime() - a.config.modifiedAt.getTime();
      });
      setNotebookNotes(notes);
      setNotebookDirectories(
        await crossnote.getNotebookDirectoriesFromNotes(notes)
      );
      setSelectedNote(notes[0]);
    })();
  }, [crossnote, selectedNotebook]);

  useEffect(() => {
    if (crossnote && selectedNotebook) {
      setSelectedDir("$notes");
    }
  }, [crossnote, selectedNotebook]);

  useEffect(() => {
    if (crossnote && selectedNotebook && notebookNotes) {
      if (
        notebookNotes.length &&
        notebookNotes[0].notebook._id !== selectedNotebook._id
      ) {
        return;
      }

      let notes: Note[] = [];
      if (selectedDir === "$notes") {
        notes = [...notebookNotes];
      } else if (selectedDir === "$todo") {
        notes = notebookNotes.filter(note =>
          note.markdown.match(/(\*|-|\d+\.)\s\[(\s+|x|X)\]\s/gm)
        );
      } else if (selectedDir === "$today") {
        notes = notebookNotes.filter(
          note => Date.now() - note.config.modifiedAt.getTime() <= OneDay
        );
      } else {
        if (includeSubdirectories) {
          notes = notebookNotes.filter(
            note => note.filePath.indexOf(selectedDir + "/") === 0
          );
        } else {
          notes = notebookNotes.filter(
            note => path.dirname(note.filePath) === selectedDir
          );
        }
      }

      setNotes(notes);
      if (!selectedNote) {
        setSelectedNote(notes[0]);
      }
    }
  }, [
    selectedDir,
    crossnote,
    selectedNotebook,
    includeSubdirectories,
    selectedNote,
    notebookNotes
  ]);

  const _setSelectedNotebook = useCallback(
    (notebook: Notebook) => {
      localStorage.setItem("selectedNotebookID", notebook._id);
      setSelectedNotebook(notebook);
    },
    [setSelectedNotebook]
  );

  return {
    crossnote,
    notebooks,
    selectedNotebook,
    setSelectedNotebook: _setSelectedNotebook,
    notes,
    selectedNote,
    setSelectedNote,
    updateNoteMarkdown,
    createNewNote,
    selectedDir,
    setSelectedDir,
    includeSubdirectories,
    setIncludeSubdirectories,
    deleteNote,
    changeNoteFilePath,
    notebookDirectories,
    addNotebook,
    isAddingNotebook,
    isPushingNotebook,
    isPullingNotebook,
    updateNotebook,
    deleteNotebook,
    pushNotebook,
    pullNotebook,
    checkoutNote,
    displayMobileEditor,
    setDisplayMobileEditor
  };
}

export const CrossnoteContainer = createContainer(useCrossnoteContainer);

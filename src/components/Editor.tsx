import React, { useState, useCallback, useEffect } from "react";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import clsx from "clsx";
import { Note } from "../lib/crossnote";
import { CrossnoteContainer } from "../containers/crossnote";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Tooltip,
  TextField,
  ButtonGroup,
  IconButton,
  Popover,
  List,
  ListItem
} from "@material-ui/core";
import { Editor as CodeMirrorEditor, EditorChangeLinkedList } from "codemirror";
import {
  RenameBox,
  Delete,
  FilePresentationBox,
  Pencil,
  CodeTags,
  CloudUploadOutline,
  CloudDownloadOutline,
  Restore,
  Fullscreen,
  FullscreenExit,
  ChevronLeft,
  Tag,
  Close
} from "mdi-material-ui";
import { renderPreview } from "vickymd/preview";
import PushNotebookDialog from "./PushNotebookDialog";
import Noty from "noty";
import { formatDistance } from "date-fns";

const VickyMD = require("vickymd");

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    editorPanel: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column"
    },
    topPanel: {
      position: "relative",
      padding: theme.spacing(0.5, 1), // theme.spacing(0.5, 1),
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: "1px solid #eee",
      overflow: "auto"
    },
    bottomPanel: {
      position: "relative",
      padding: theme.spacing(0.5, 1),
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderTop: "1px solid #eee"
      // color: theme.palette.primary.contrastText,
      // backgroundColor: theme.palette.primary.main
    },
    controlBtn: {
      padding: theme.spacing(0.5, 0),
      color: theme.palette.text.secondary
    },
    controlBtnSelected: {
      color: theme.palette.primary.main
    },
    row: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center"
    },
    cursorPositionInfo: {
      // position: "absolute",
      // right: "16px",
      // bottom: "16px",
      zIndex: 150
    },
    editorWrapper: {
      //     display: "contents",
      flex: 1,
      overflow: "auto",
      "& .CodeMirror-gutters": {
        display: "none"
      },
      "& .CodeMirror-code": {
        width: "100%"
      },
      "& .CodeMirror": {
        height: "100%",
        padding: theme.spacing(0, 2),
        [theme.breakpoints.down("sm")]: {
          padding: theme.spacing(0)
        }
      },
      "& .CodeMirror-vscrollbar": {
        display: "none !important"
      },
      [theme.breakpoints.down("sm")]: {
        padding: theme.spacing(1)
      }
    },
    fullScreen: {
      position: "fixed",
      width: "100%",
      height: "100%",
      left: "0",
      top: "0",
      zIndex: 2000,
      overflow: "auto"
    },
    editor: {
      width: "100%",
      height: "100%"
    },
    preview: {
      position: "relative",
      left: "0",
      top: "0",
      width: "100%",
      height: "100%",
      border: "none",
      overflow: "auto !important",
      padding: theme.spacing(2),
      zIndex: 99,
      [theme.breakpoints.down("sm")]: {
        padding: theme.spacing(1)
      }
      // gridArea: "2 / 2 / 3 / 3"
    },
    backBtn: {
      marginRight: "8px",
      [theme.breakpoints.up("sm")]: {
        display: "none"
      }
    },
    menuItemOverride: {
      cursor: "default",
      padding: `0 0 0 ${theme.spacing(2)}px`,
      "&:hover": {
        backgroundColor: "inherit"
      }
    },
    menuItemTextField: {
      paddingRight: theme.spacing(2)
    }
  })
);

export enum EditorMode {
  VickyMD = "VickyMD",
  SourceCode = "SourceCode",
  Preview = "Preview"
}
interface CursorPosition {
  ch: number;
  line: number;
}
interface TimerText {
  text: string;
  line: number;
  date: Date;
}
interface Props {
  note: Note;
}
export default function Editor(props: Props) {
  const note = props.note;
  const classes = useStyles(props);
  const [textAreaElement, setTextAreaElement] = useState<HTMLTextAreaElement>(
    null
  );
  const [editor, setEditor] = useState<CodeMirrorEditor>(null);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({
    line: 0,
    ch: 0
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [filePathDialogOpen, setFilePathDialogOpen] = useState<boolean>(false);
  const [pushDialogOpen, setPushDialogOpen] = useState<boolean>(false);
  const [newFilePath, setNewFilePath] = useState<string>(note.filePath);
  const [editorMode, setEditorMode] = useState<EditorMode>(EditorMode.VickyMD);
  const [previewElement, setPreviewElement] = useState<HTMLElement>(null);
  const [gitStatus, setGitStatus] = useState<string>("");
  const [fullScreenMode, setFullScreenMode] = useState<boolean>(false);
  const [tagsMenuAnchorEl, setTagsMenuAnchorEl] = useState<HTMLElement>(null);
  const [tagName, setTagName] = useState<string>("");
  const [tagNames, setTagNames] = useState<string[]>([]);
  const crossnoteContainer = CrossnoteContainer.useContainer();
  const { t } = useTranslation();

  const closeFilePathDialog = useCallback(() => {
    setFilePathDialogOpen(false);
    setNewFilePath(note.filePath);
  }, [note]);

  const changeFilePath = useCallback(
    (newFilePath: string) => {
      (async () => {
        newFilePath = newFilePath.replace(/^\/+/, "");
        if (!newFilePath.endsWith(".md")) {
          newFilePath = newFilePath + ".md";
        }
        if (note.filePath !== newFilePath) {
          await crossnoteContainer.changeNoteFilePath(note, newFilePath);
        }
        setNewFilePath(newFilePath);
        setFilePathDialogOpen(false);
      })();
    },
    [note, closeFilePathDialog]
  );

  const pullNotebook = useCallback(() => {
    new Noty({
      type: "info",
      text: "Pulling notebook...",
      layout: "topRight",
      theme: "relax",
      timeout: 2000
    }).show();
    crossnoteContainer
      .pullNotebook({
        notebook: note.notebook,
        onAuthFailure: () => {
          new Noty({
            type: "error",
            text: "Authentication failed",
            layout: "topRight",
            theme: "relax",
            timeout: 5000
          }).show();
        }
      })
      .then(() => {
        new Noty({
          type: "success",
          text: "Notebook pulled",
          layout: "topRight",
          theme: "relax",
          timeout: 2000
        }).show();
      })
      .catch(error => {
        console.log(error);
        new Noty({
          type: "error",
          text: "Failed to pull notebook",
          layout: "topRight",
          theme: "relax",
          timeout: 2000
        }).show();
      });
  }, [note]);

  const checkoutNote = useCallback(() => {
    crossnoteContainer.checkoutNote(note);
  }, [note]);

  const addTag = useCallback(() => {
    let tag = tagName.trim() || "";
    if (!note || !tag.length || !editor) {
      return;
    }
    tag = tag
      .replace(/\s+/g, " ")
      .split("/")
      .map(t => t.trim())
      .filter(x => x.length > 0)
      .join("/");
    setTagNames(tagNames => {
      const newTagNames =
        tagNames.indexOf(tag) >= 0 ? [...tagNames] : [tag, ...tagNames];
      note.config.tags = newTagNames.sort((x, y) => x.localeCompare(y));
      crossnoteContainer.updateNoteMarkdown(note, editor.getValue(), status => {
        setGitStatus(status);
      });
      crossnoteContainer.updateNotebookTagNode();
      return newTagNames;
    });
    setTagName("");
  }, [tagName, note, editor]);

  const deleteTag = useCallback(
    (tagName: string) => {
      setTagNames(tagNames => {
        const newTagNames = tagNames.filter(t => t !== tagName);
        note.config.tags = newTagNames.sort((x, y) => x.localeCompare(y));
        crossnoteContainer.updateNoteMarkdown(
          note,
          editor.getValue(),
          status => {
            setGitStatus(status);
          }
        );
        crossnoteContainer.updateNotebookTagNode();
        return newTagNames;
      });
    },
    [note, editor]
  );

  useEffect(() => {
    setNewFilePath(note.filePath);
  }, [note.filePath]);

  useEffect(() => {
    crossnoteContainer.crossnote.getStatus(note).then(status => {
      setGitStatus(status);
    });
  }, [note, crossnoteContainer.crossnote]);

  useEffect(() => {
    if (crossnoteContainer.displayMobileEditor && editor) {
      editor.setValue(note.markdown || "");
    }
  }, [crossnoteContainer.displayMobileEditor, editor, note]);

  useEffect(() => {
    if (textAreaElement && !editor) {
      // console.log("textarea element mounted");
      const editor: CodeMirrorEditor = VickyMD.fromTextArea(textAreaElement, {
        mode: {
          name: "hypermd",
          hashtag: true
        },
        inputStyle: "textarea"
      });
      editor.setOption("lineNumbers", false);
      editor.setOption("foldGutter", false);
      // editor.setOption("readOnly", false);
      editor.setValue(note.markdown || "");
      // crossnoteContainer.setEditor(editor);
      editor.on("cursorActivity", instance => {
        const cursor = instance.getCursor();
        if (cursor) {
          setCursorPosition({
            line: cursor.line,
            ch: cursor.ch
          });
        }
      });
      setEditor(editor);
    }
  }, [textAreaElement, note, editor]);

  useEffect(() => {
    if (editor && note) {
      setTagNames(note.config.tags);
      editor.setValue(note.markdown);
      const handler = () => {
        const markdown = editor.getValue();
        crossnoteContainer.updateNoteMarkdown(note, markdown, status => {
          setGitStatus(status);
          setTagNames(note.config.tags); // After resolve conflicts
        });
      };
      editor.on("changes", handler);
      return () => {
        editor.off("changes", handler);
      };
    }
  }, [editor, note]);

  useEffect(() => {
    if (!editor) return;
    if (editorMode === EditorMode.VickyMD) {
      VickyMD.switchToHyperMD(editor);
      editor.getWrapperElement().style.display = "block";
    } else if (editorMode === EditorMode.SourceCode) {
      VickyMD.switchToNormal(editor);
      editor.getWrapperElement().style.display = "block";
    } else {
      editor.getWrapperElement().style.display = "none";
    }
  }, [editorMode, editor, note]);

  useEffect(() => {
    if (editorMode === EditorMode.Preview && editor && previewElement) {
      renderPreview(previewElement, editor.getValue());
      if (
        previewElement.childElementCount &&
        previewElement.children[0].tagName.toUpperCase() === "IFRAME"
      ) {
        // presentation
        previewElement.style.maxWidth = "100%";
        previewElement.style.height = "100%";
        previewElement.style.overflow = "hidden !important";
      } else {
        // normal
        // previewElement.style.maxWidth = `${EditorPreviewMaxWidth}px`;
        previewElement.style.height = "auto";
        previewElement.style.overflow = "hidden !important";
      }
    }
  }, [editorMode, editor, previewElement, note]);

  useEffect(() => {
    if (!editor) return;
    const onChangeHandler = (
      instance: CodeMirrorEditor,
      changeObject: EditorChangeLinkedList
    ) => {
      // Check commands
      if (changeObject.text.length === 1 && changeObject.text[0] === "/") {
        editor.showHint({
          closeOnUnfocus: false,
          completeSingle: false,
          hint: () => {
            const cursor = editor.getCursor();
            const token = editor.getTokenAt(cursor);
            const start = token.string.lastIndexOf("/");
            const line = cursor.line;
            const end: number = cursor.ch;
            const currentWord: string = token.string.slice(start + 1, end);

            const commands = [
              {
                text: "# ",
                displayText: `/h1 - ${t("editor/toolbar/insert-header-1")}`
              },
              {
                text: "## ",
                displayText: `/h2 - ${t("editor/toolbar/insert-header-2")}`
              },
              {
                text: "### ",
                displayText: `/h3 - ${t("editor/toolbar/insert-header-3")}`
              },
              {
                text: "#### ",
                displayText: `/h4 - ${t("editor/toolbar/insert-header-4")}`
              },
              {
                text: "##### ",
                displayText: `/h5 - ${t("editor/toolbar/insert-header-5")}`
              },
              {
                text: "###### ",
                displayText: `/h6 - ${t("editor/toolbar/insert-header-6")}`
              },
              {
                text: "> ",
                displayText: `/blockquote - ${t(
                  "editor/toolbar/insert-blockquote"
                )}`
              },
              {
                text: "* ",
                displayText: `/ul - ${t(
                  "editor/toolbar/insert-unordered-list"
                )}`
              },
              {
                text: "1. ",
                displayText: `/ol - ${t("editor/toolbar/insert-ordered-list")}`
              },
              {
                text: "`@crossnote.image`\n",
                displayText: `/image - ${t("editor/toolbar/insert-image")}`
              },
              {
                text: `|   |   |
|---|---|
|   |   |
`,
                displayText: `/table - ${t("editor/toolbar/insert-table")}`
              },
              {
                text:
                  "`@timer " +
                  JSON.stringify({ date: new Date().toString() })
                    .replace(/^{/, "")
                    .replace(/}$/, "") +
                  "`\n",
                displayText: `/timer - ${t("editor/toolbar/insert-clock")}`
              },
              {
                text: "",
                displayText: `/emoji - ${t("editor/toolbar/insert-emoji")}`
              },
              {
                text: "`@crossnote.audio`  \n",
                displayText: `/audio - ${t("editor/toolbar/audio-url")}`
              },
              {
                text: "`@crossnote.netease_music`  \n",
                displayText: `/netease - ${t("editor/toolbar/netease-music")}`
              },
              {
                text: "`@crossnote.video`  \n",
                displayText: `/video - ${t("editor/toolbar/video-url")}`
              },
              {
                text: "`@crossnote.youtube`  \n",
                displayText: `/youtube - ${t("editor/toolbar/youtube")}`
              },
              {
                text: "`@crossnote.bilibili`  \n",
                displayText: `/bilibili - ${t("editor/toolbar/bilibili")}`
              },
              {
                text: "<!-- slide -->  \n",
                displayText: `/slide - ${t("editor/toolbar/insert-slide")}`
              },
              {
                text: "`@crossnote.ocr`  \n",
                displayText: `/ocr - ${t("editor/toolbar/insert-ocr")}`
              },
              {
                text: '`@crossnote.kanban "v":2,"board":{"columns":[]}`  \n',
                displayText: `/kanban - ${t(
                  "editor/toolbar/insert-kanban"
                )} (beta)`
              },
              {
                text: "`@crossnote.abc`  \n",
                displayText: `/abc - ${t("editor/toolbar/insert-abc-notation")}`
              }
            ];
            const filtered = commands.filter(
              item =>
                item.displayText
                  .toLocaleLowerCase()
                  .indexOf(currentWord.toLowerCase()) >= 0
            );
            return {
              list: filtered.length ? filtered : commands,
              from: { line, ch: start },
              to: { line, ch: end }
            };
          }
        });
      }

      // Timer
      if (
        changeObject.text.length > 0 &&
        changeObject.text[0].startsWith("`@timer ") &&
        changeObject.removed.length > 0 &&
        changeObject.removed[0].startsWith("/")
      ) {
        // Calcuate date time
        const lines = editor.getValue().split("\n");
        const timerTexts: TimerText[] = [];
        for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(/^`@timer\s.+`/);
          if (match) {
            const text = match[0];
            const dataMatch = text.match(/^`@timer\s+(.+)`/);
            if (!dataMatch || !dataMatch.length) {
              continue;
            }
            const dataStr = dataMatch[1];
            try {
              const data = JSON.parse(`{${dataStr}}`);
              const datetime = data["date"];
              if (datetime) {
                timerTexts.push({
                  text: text,
                  line: i,
                  date: new Date(datetime)
                });
              }
            } catch (error) {
              continue;
            }
          }
        }
        for (let i = 1; i < timerTexts.length; i++) {
          const currentTimerText = timerTexts[i];
          const previousTimerText = timerTexts[i - 1];
          const duration = formatDistance(
            currentTimerText.date,
            previousTimerText.date,
            { includeSeconds: true }
          );
          const newText = `\`@timer ${JSON.stringify({
            date: currentTimerText.date.toString(),
            duration
          })
            .replace(/^{/, "")
            .replace(/}$/, "")}\``;
          editor.replaceRange(
            newText,
            { line: currentTimerText.line, ch: 0 },
            { line: currentTimerText.line, ch: currentTimerText.text.length }
          );
        }
      }
    };
    editor.on("change", onChangeHandler);

    const onCursorActivityHandler = (instance: CodeMirrorEditor) => {
      // console.log("cursorActivity", editor.getCursor());
      // console.log("selection: ", editor.getSelection());
      return;
    };
    editor.on("cursorActivity", onCursorActivityHandler);

    return () => {
      editor.off("change", onChangeHandler);
      editor.off("cursorActivity", onCursorActivityHandler);
    };
  }, [editor, note /*t*/]);

  return (
    <Box className={clsx(classes.editorPanel)}>
      <Box className={clsx(classes.topPanel)}>
        <Box className={clsx(classes.row)}>
          <ButtonGroup className={clsx(classes.backBtn)}>
            <Button
              className={clsx(classes.controlBtn)}
              onClick={() => {
                crossnoteContainer.setDisplayMobileEditor(false);
              }}
            >
              <ChevronLeft></ChevronLeft>
            </Button>
          </ButtonGroup>
          <ButtonGroup
            variant={"outlined"}
            color="default"
            aria-label="editor mode"
          >
            <Tooltip title={t("general/vickymd")}>
              <Button
                className={clsx(
                  classes.controlBtn,
                  editorMode === EditorMode.VickyMD &&
                    classes.controlBtnSelected
                )}
                color={
                  editorMode === EditorMode.VickyMD ? "primary" : "default"
                }
                onClick={() => setEditorMode(EditorMode.VickyMD)}
              >
                <Pencil></Pencil>
              </Button>
            </Tooltip>
            <Tooltip title={t("editor/note-control/source-code")}>
              <Button
                className={clsx(
                  classes.controlBtn,
                  editorMode === EditorMode.SourceCode &&
                    classes.controlBtnSelected
                )}
                color={
                  editorMode === EditorMode.SourceCode ? "primary" : "default"
                }
                onClick={() => setEditorMode(EditorMode.SourceCode)}
              >
                <CodeTags></CodeTags>
              </Button>
            </Tooltip>
            <Tooltip title={t("editor/note-control/preview")}>
              <Button
                className={clsx(
                  classes.controlBtn,
                  editorMode === EditorMode.Preview &&
                    classes.controlBtnSelected
                )}
                color={
                  editorMode === EditorMode.Preview ? "primary" : "default"
                }
                onClick={() => setEditorMode(EditorMode.Preview)}
              >
                <FilePresentationBox></FilePresentationBox>
              </Button>
            </Tooltip>
          </ButtonGroup>
          <ButtonGroup style={{ marginLeft: "8px" }}>
            <Tooltip title={"Tags"}>
              <Button
                className={clsx(classes.controlBtn)}
                onClick={event => setTagsMenuAnchorEl(event.currentTarget)}
              >
                <Tag></Tag>
              </Button>
            </Tooltip>
          </ButtonGroup>
          <ButtonGroup style={{ marginLeft: "8px" }}>
            <Tooltip title={"Fullscreen"}>
              <Button
                className={clsx(classes.controlBtn)}
                onClick={() => setFullScreenMode(true)}
              >
                <Fullscreen></Fullscreen>
              </Button>
            </Tooltip>
          </ButtonGroup>
          <ButtonGroup style={{ marginLeft: "8px" }}>
            <Tooltip title={"Change file path"}>
              <Button
                className={clsx(classes.controlBtn)}
                onClick={() => setFilePathDialogOpen(true)}
              >
                <RenameBox></RenameBox>
              </Button>
            </Tooltip>
            <Tooltip title={"Restore (checkout)"}>
              <Button
                className={clsx(classes.controlBtn)}
                onClick={checkoutNote}
              >
                <Restore></Restore>
              </Button>
            </Tooltip>
            <Tooltip title={"Delete file"}>
              <Button
                className={clsx(classes.controlBtn)}
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Delete></Delete>
              </Button>
            </Tooltip>
          </ButtonGroup>
          {note.notebook.gitURL && ( // If no git url set, then don't allow push/pull
            <ButtonGroup style={{ marginLeft: "8px" }}>
              <Tooltip title={"Upload (Push)"}>
                <Button
                  className={clsx(classes.controlBtn)}
                  onClick={() => setPushDialogOpen(true)}
                  disabled={
                    crossnoteContainer.isPullingNotebook ||
                    crossnoteContainer.isPushingNotebook
                  }
                >
                  <CloudUploadOutline></CloudUploadOutline>
                </Button>
              </Tooltip>
              <Tooltip title={"Download (Pull)"}>
                <Button
                  className={clsx(classes.controlBtn)}
                  onClick={pullNotebook}
                  disabled={
                    crossnoteContainer.isPullingNotebook ||
                    crossnoteContainer.isPushingNotebook
                  }
                >
                  <CloudDownloadOutline></CloudDownloadOutline>
                </Button>
              </Tooltip>
            </ButtonGroup>
          )}
          <Popover
            open={Boolean(tagsMenuAnchorEl)}
            anchorEl={tagsMenuAnchorEl}
            keepMounted
            onClose={() => setTagsMenuAnchorEl(null)}
          >
            <List>
              <ListItem
                className={clsx(
                  classes.menuItemOverride,
                  classes.menuItemTextField
                )}
              >
                <TextField
                  placeholder={"Add tag..."}
                  autoFocus={true}
                  value={tagName}
                  onChange={event => {
                    event.stopPropagation();
                    setTagName(event.target.value);
                  }}
                  onKeyUp={event => {
                    if (event.which === 13) {
                      addTag();
                    }
                  }}
                ></TextField>
              </ListItem>
              {tagNames.length > 0 ? (
                tagNames.map(tagName => {
                  return (
                    <ListItem
                      key={tagName}
                      className={clsx(classes.menuItemOverride)}
                    >
                      <Box
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%"
                        }}
                      >
                        <Typography>{tagName}</Typography>
                        <IconButton onClick={() => deleteTag(tagName)}>
                          <Close></Close>
                        </IconButton>
                      </Box>
                    </ListItem>
                  );
                })
              ) : (
                <ListItem className={clsx(classes.menuItemOverride)}>
                  <Typography style={{ margin: "8px 0" }}>
                    {"No tags"}
                  </Typography>
                </ListItem>
              )}
            </List>
          </Popover>
        </Box>
      </Box>
      <Box
        className={clsx(
          classes.editorWrapper,
          fullScreenMode ? classes.fullScreen : null
        )}
      >
        <textarea
          className={clsx(classes.editor, "editor-textarea")}
          placeholder={t("editor/placeholder")}
          ref={(element: HTMLTextAreaElement) => {
            setTextAreaElement(element);
          }}
        ></textarea>
        {editorMode === EditorMode.Preview &&
        /*!editorContainer.pinPreviewOnTheSide &&*/
        editor ? (
          <div
            className={clsx(classes.preview, "preview")}
            id="preview"
            ref={(element: HTMLElement) => {
              setPreviewElement(element);
            }}
          ></div>
        ) : null}
        {fullScreenMode && (
          <IconButton
            style={{
              position: "fixed",
              right: "0",
              top: "0",
              zIndex: 2001
            }}
            onClick={() => setFullScreenMode(false)}
          >
            <FullscreenExit></FullscreenExit>
          </IconButton>
        )}
      </Box>
      <Box className={clsx(classes.bottomPanel)}>
        <Box className={clsx(classes.row)}>
          <Typography
            variant={"caption"}
            style={{ cursor: "pointer" }}
            onClick={() => {
              setFilePathDialogOpen(true);
            }}
          >
            {note.filePath}
          </Typography>
          <Typography variant={"caption"} style={{ marginLeft: "4px" }}>
            {"- " + gitStatus}
          </Typography>
        </Box>
        <Box className={clsx(classes.cursorPositionInfo)}>
          <Typography variant={"caption"}>
            {`Ln ${cursorPosition.line + 1}, Col ${cursorPosition.ch}`}
          </Typography>
        </Box>
      </Box>
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Are you sure to delete this file?</DialogTitle>
        <DialogContent>
          <DialogContentText>Can't be undone</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            style={{ color: "red" }}
            onClick={() => {
              crossnoteContainer.deleteNote(note);
              setDeleteDialogOpen(false);
            }}
          >
            Delete
          </Button>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={filePathDialogOpen} onClose={closeFilePathDialog}>
        <DialogTitle>Change file path</DialogTitle>
        <DialogContent>
          <TextField
            value={newFilePath}
            autoFocus={true}
            onChange={event => setNewFilePath(event.target.value)}
            onKeyUp={event => {
              if (event.which === 13) {
                changeFilePath(newFilePath);
              }
            }}
          ></TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => changeFilePath(newFilePath)}>Save</Button>
          <Button onClick={closeFilePathDialog}>Cancel</Button>
        </DialogActions>
      </Dialog>
      <PushNotebookDialog
        open={pushDialogOpen}
        onClose={() => setPushDialogOpen(false)}
        notebook={note.notebook}
      ></PushNotebookDialog>
    </Box>
  );
}

import React, { useState } from "react";
import {
  fade,
  createStyles,
  makeStyles,
  Theme
} from "@material-ui/core/styles";
import clsx from "clsx";
import { CrossnoteContainer } from "../containers/crossnote";
import {
  Box,
  InputBase,
  Card,
  IconButton,
  Typography,
  Hidden
} from "@material-ui/core";
import NoteCard from "./NoteCard";
import {
  Magnify,
  FileEditOutline,
  Settings,
  Menu as MenuIcon
} from "mdi-material-ui";
import { useTranslation } from "react-i18next";
import ConfigureNotebookDialog from "./ConfigureNotebookDialog";

const OneDay = 1000 * 60 * 60 * 24;

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    notes: {
      display: "flex",
      flexDirection: "column",
      height: "100%"
    },
    topPanel: {
      padding: theme.spacing(1)
    },
    row: {
      display: "flex",
      alignItems: "center"
    },
    sectionName: {
      marginLeft: theme.spacing(1)
    },
    search: {
      position: "relative",
      borderRadius: theme.shape.borderRadius,
      backgroundColor: fade(theme.palette.common.white, 0.15),
      "&:hover": {
        backgroundColor: fade(theme.palette.common.white, 0.25)
      },
      marginRight: 0, // theme.spacing(2),
      marginLeft: 0,
      width: "100%",
      [theme.breakpoints.up("sm")]: {
        // marginLeft: theme.spacing(3),
        // width: "auto"
      }
    },
    searchIcon: {
      width: theme.spacing(7),
      color: "rgba(0, 0, 0, 0.54)",
      height: "100%",
      position: "absolute",
      pointerEvents: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    inputRoot: {
      color: "inherit",
      border: "1px solid #bbb",
      borderRadius: "4px"
    },
    inputInput: {
      padding: theme.spacing(1, 1, 1, 7),
      transition: theme.transitions.create("width"),
      width: "100%",
      [theme.breakpoints.up("md")]: {
        // width: 200
      }
    },
    notesList: {
      flex: "1",
      overflowY: "auto",
      paddingBottom: theme.spacing(12)
    }
  })
);

interface Props {
  toggleDrawer: () => void;
}

export default function Notes(props: Props) {
  const classes = useStyles(props);
  const { t } = useTranslation();
  const crossnoteContainer = CrossnoteContainer.useContainer();

  // Search
  const [searchValue, setSearchValue] = useState<string>("");

  const [
    notebookConfigurationDialogOpen,
    setNotebookConfigurationDialogOpen
  ] = useState<boolean>(false);

  return (
    <Box className={clsx(classes.notes)}>
      <Card className={clsx(classes.topPanel)}>
        <Box className={clsx(classes.row)}>
          <Hidden smUp implementation="css">
            <IconButton onClick={props.toggleDrawer}>
              <MenuIcon></MenuIcon>
            </IconButton>
          </Hidden>
          <div className={classes.search}>
            <div className={classes.searchIcon}>
              <Magnify />
            </div>
            <InputBase
              placeholder={t("search/placeholder")}
              classes={{
                root: classes.inputRoot,
                input: classes.inputInput
              }}
              value={searchValue}
              inputProps={{ "aria-label": "search" }}
              onChange={event => setSearchValue(event.target.value)}
            />
          </div>
          <IconButton
            onClick={() => {
              crossnoteContainer.createNewNote();
            }}
          >
            <FileEditOutline></FileEditOutline>
          </IconButton>
        </Box>
        <Box
          className={clsx(classes.row)}
          style={{ justifyContent: "space-between" }}
        >
          {crossnoteContainer.selectedDir === "$notes" ? (
            <Box className={clsx(classes.row)}>
              <span role="img" aria-label="notes">
                📒
              </span>
              <Typography className={clsx(classes.sectionName)}>
                {crossnoteContainer.selectedNotebook &&
                  crossnoteContainer.selectedNotebook.name}
              </Typography>
            </Box>
          ) : crossnoteContainer.selectedDir === "$today" ? (
            <Box className={clsx(classes.row)}>
              <span role="img" aria-label="today-notes">
                🗓
              </span>
              <Typography className={clsx(classes.sectionName)}>
                {" today"}
              </Typography>
            </Box>
          ) : crossnoteContainer.selectedDir === "$todo" ? (
            <Box className={clsx(classes.row)}>
              <span role="img" aria-label="todo-notes">
                ☑️
              </span>
              <Typography className={clsx(classes.sectionName)}>
                {" todo"}
              </Typography>
            </Box>
          ) : crossnoteContainer.selectedDir === "$tagged" ? (
            <Box className={clsx(classes.row)}>
              <span role="img" aria-label="tagged-notes">
                🏷️
              </span>
              <Typography className={clsx(classes.sectionName)}>
                {" tagged"}
              </Typography>
            </Box>
          ) : crossnoteContainer.selectedDir === "$untagged" ? (
            <Box className={clsx(classes.row)}>
              <span role="img" aria-label="untagged-notes">
                🈚
              </span>
              <Typography className={clsx(classes.sectionName)}>
                {" untagged"}
              </Typography>
            </Box>
          ) : (
            crossnoteContainer.selectedDir && (
              <Box className={clsx(classes.row)}>
                <span role="img" aria-label="folder">
                  {"📁"}
                </span>
                <Typography className={clsx(classes.sectionName)}>
                  {crossnoteContainer.selectedDir}
                </Typography>
              </Box>
            )
          )}

          {crossnoteContainer.selectedDir === "$notes" && (
            <IconButton
              onClick={() => setNotebookConfigurationDialogOpen(true)}
            >
              <Settings></Settings>
            </IconButton>
          )}
        </Box>
      </Card>

      <ConfigureNotebookDialog
        open={notebookConfigurationDialogOpen}
        onClose={() => setNotebookConfigurationDialogOpen(false)}
        notebook={crossnoteContainer.selectedNotebook}
      ></ConfigureNotebookDialog>

      <Box className={clsx(classes.notesList)}>
        {crossnoteContainer.notes.map(note => {
          if (searchValue.trim().length) {
            const regexp = new RegExp(
              "(" +
                searchValue
                  .trim()
                  .split(/\s+/g)
                  // .map(s => "\\" + s.split("").join("\\"))
                  .join("|") +
                ")",
              "i"
            );

            if (
              note.title.match(regexp) ||
              note.markdown.match(regexp) ||
              note.filePath.match(regexp)
            ) {
              return (
                <NoteCard
                  key={"note-card-" + note.filePath}
                  note={note}
                ></NoteCard>
              );
            }
          } else {
            return (
              <NoteCard
                key={"note-card-" + note.filePath}
                note={note}
              ></NoteCard>
            );
          }
        })}
      </Box>
    </Box>
  );
}

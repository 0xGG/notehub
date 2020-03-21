import React, { useState, useEffect } from "react";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import clsx from "clsx";
import { CrossnoteContainer } from "../containers/crossnote";
import { Box } from "@material-ui/core";
import NoteCard from "./NoteCard";
import { useTranslation } from "react-i18next";
import { Note } from "../lib/crossnote";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    notesList: {
      position: "relative",
      flex: "1",
      overflowY: "auto",
      paddingBottom: theme.spacing(12)
    }
  })
);

interface Props {
  searchValue: string;
}

export default function Notes(props: Props) {
  const classes = useStyles(props);
  const { t } = useTranslation();
  const crossnoteContainer = CrossnoteContainer.useContainer();
  const [notes, setNotes] = useState<Note[]>([]);
  const searchValue = props.searchValue;

  useEffect(() => {
    const pinned: Note[] = [];
    const unpinned: Note[] = [];
    crossnoteContainer.notes.forEach(note => {
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

        if (note.markdown.match(regexp) || note.filePath.match(regexp)) {
          if (note.config.pinned) {
            pinned.push(note);
          } else {
            unpinned.push(note);
          }
        }
      } else {
        if (note.config.pinned) {
          pinned.push(note);
        } else {
          unpinned.push(note);
        }
      }
    });

    setNotes([...pinned, ...unpinned]);
  }, [crossnoteContainer.notes, searchValue]);

  return (
    <Box className={clsx(classes.notesList)}>
      {(notes || []).map(note => {
        return (
          <NoteCard key={"note-card-" + note.filePath} note={note}></NoteCard>
        );
      })}
    </Box>
  );
}

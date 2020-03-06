import { WidgetCreator, WidgetArgs } from "vickymd/widget";
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  Card,
  Typography,
  IconButton,
  Box,
  CardContent,
  TextField
} from "@material-ui/core";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import clsx from "clsx";
import { CardPlus, Close, ContentSave, Cancel } from "mdi-material-ui";
import { useTranslation } from "react-i18next";

// @ts-ignore
import Board from "@lourenci/react-kanban";
import { Editor as CodeMirrorEditor } from "codemirror";
import { renderPreview } from "vickymd/preview";
const VickyMD = require("vickymd");

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    laneHeader: {
      width: "256px",
      maxWidth: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    },
    kanbanCard: {
      width: "256px",
      maxWidth: "100%",
      position: "relative",
      [theme.breakpoints.down("sm")]: {
        marginTop: "4px",
        marginBottom: "4px"
      }
    },
    editorWrapper: {
      // height: "160px",
      // border: "2px solid #96c3e6",
      "& .CodeMirror-gutters": {
        display: "none"
      }
    },
    textarea: {
      width: "100%",
      height: "100%"
    },
    preview: {
      padding: theme.spacing(2)
    }
  })
);

interface KanbanCard {
  id: number;
  title: string;
  description: string;
}

interface KanbanLane {
  id: number;
  title: string;
  wip: boolean;
  cards: KanbanCard[];
}

interface KanbanBoard {
  lanes: KanbanLane[];
}

interface KanbanLaneHeaderProps {
  lane: KanbanLane;
  board: KanbanBoard;
  refreshBoard: (board: Board) => void;
  isPreview: boolean;
}

function KanbanLaneHeaderDisplay(props: KanbanLaneHeaderProps) {
  const classes = useStyles(props);
  const { t } = useTranslation();
  const lane = props.lane;
  const board = props.board;
  const isPreview = props.isPreview;
  const refreshBoard = props.refreshBoard;
  const [clickedTitle, setClickedTitle] = useState<boolean>(false);
  const [titleValue, setTitleValue] = useState<string>(lane.title);

  useEffect(() => {
    if (!clickedTitle && titleValue !== lane.title) {
      lane.title = titleValue || t("general/Untitled");
      setTitleValue(lane.title);
      refreshBoard(board);
    }
  }, [clickedTitle, board, lane.title, titleValue, t, refreshBoard]);

  return (
    <Box className={clsx(classes.laneHeader)}>
      <Box>
        {clickedTitle ? (
          <TextField
            value={titleValue}
            onChange={event => {
              setTitleValue(event.target.value);
            }}
            onBlur={() => {
              setClickedTitle(false);
            }}
            onKeyUp={event => {
              if (event.which === 13) {
                setClickedTitle(false);
              }
            }}
          ></TextField>
        ) : (
          <Typography
            variant={"body1"}
            style={{ cursor: "text" }}
            onClick={() => {
              if (!isPreview) {
                setClickedTitle(true);
              }
            }}
          >
            {titleValue}
          </Typography>
        )}
      </Box>
      {!isPreview && (
        <Box>
          <IconButton
            onClick={() => {
              const card: KanbanCard = {
                id: Date.now(),
                title: "", //"Card " + lane.cards.length,
                description: "empty"
              };
              if (lane) {
                lane.cards.push(card);
              }
              props.refreshBoard(board);
            }}
          >
            <CardPlus></CardPlus>
          </IconButton>
          <IconButton
            onClick={() => {
              board.lanes = board.lanes.filter(l => lane.id !== l.id);
              props.refreshBoard(board);
            }}
          >
            <Close></Close>
          </IconButton>
        </Box>
      )}
    </Box>
  );
}

interface KanbanCardProps {
  card: KanbanCard;
  board: KanbanBoard;
  refreshBoard: (board: Board) => void;
  isPreview: boolean;
}
function KanbanCardDisplay(props: KanbanCardProps) {
  const classes = useStyles(props);
  const board = props.board;
  const card = props.card;
  const isPreview = props.isPreview;
  const [textAreaElement, setTextAreaElement] = useState<HTMLTextAreaElement>(
    null
  );
  const [previewElement, setPreviewElement] = React.useState<HTMLElement>(null);

  const [editor, setEditor] = useState<CodeMirrorEditor>(null);
  const [description, setDescription] = useState<string>(card.description);
  const [clickedPreview, setClickedPreview] = useState<boolean>(false);
  const { t } = useTranslation();

  useEffect(() => {
    setDescription(card.description);
  }, [card.description]);

  useEffect(() => {
    if (textAreaElement) {
      const editor: CodeMirrorEditor = VickyMD.fromTextArea(textAreaElement, {
        mode: {
          name: "hypermd",
          hashtag: true
        },
        inputStyle: "textarea"
        // autofocus: false
      });
      editor.setValue(card.description);
      editor.setOption("lineNumbers", false);
      editor.setOption("foldGutter", false);
      editor.setOption("autofocus", false);
      if (isPreview) {
        editor.setOption("readOnly", "nocursor");
      }
      editor.on("changes", () => {
        setDescription(editor.getValue());
      });
      /*
      // Cause save not working
      editor.on("blur", () => {
        setClickedPreview(false);
        setEditor(null);
      });
      */
      // editor.display.input.blur();
      setEditor(editor);
    }
  }, [textAreaElement]);

  useEffect(() => {
    if (previewElement) {
      renderPreview(previewElement, card.description);
    }
  }, [previewElement]);

  if (isPreview || !clickedPreview) {
    return (
      <Card className={clsx(classes.kanbanCard)}>
        <div
          className={clsx("preview", classes.preview)}
          ref={(element: HTMLElement) => {
            setPreviewElement(element);
          }}
          onClick={() => {
            if (!isPreview) {
              setClickedPreview(true);
            }
          }}
        ></div>
        {!isPreview && (
          <Box
            style={{ position: "absolute", top: "0", right: "0", zIndex: 99 }}
          >
            <IconButton
              onClick={() => {
                board.lanes.forEach(lane => {
                  lane.cards = lane.cards.filter(c => c.id !== card.id);
                });
                props.refreshBoard(board);
              }}
            >
              <Close></Close>
            </IconButton>
          </Box>
        )}
      </Card>
    );
  }

  return (
    <Card className={clsx(classes.kanbanCard)}>
      <CardContent>
        <Box className={clsx(classes.editorWrapper)}>
          <textarea
            className={classes.textarea}
            ref={(element: HTMLTextAreaElement) => {
              setTextAreaElement(element);
            }}
          ></textarea>
        </Box>

        {description !== card.description && (
          <Box
          // style={{ position: "absolute", top: "0", right: "0", zIndex: 99 }}
          >
            <IconButton
              onClick={() => {
                card.description = description;
                props.refreshBoard(props.board);
                setClickedPreview(false);
              }}
            >
              <ContentSave></ContentSave>
            </IconButton>
            <IconButton
              onClick={() => {
                if (editor) {
                  editor.setValue(card.description);
                }
                setDescription(card.description);
                setClickedPreview(false);
              }}
            >
              <Cancel></Cancel>
            </IconButton>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function KanbanWidget(props: WidgetArgs) {
  const classes = useStyles(props);
  const { t } = useTranslation();
  const [board, setBoard] = useState<KanbanBoard>(
    props.attributes["board"] || {
      lanes: []
    }
  );

  const refreshBoard = (board: KanbanBoard) => {
    const newBoard = Object.assign({}, board);
    props.setAttributes({ board: newBoard });
    setBoard(newBoard as KanbanBoard);
  };

  return (
    <div>
      <Board
        renderLaneHeader={(lane: KanbanLane) => (
          <KanbanLaneHeaderDisplay
            lane={lane}
            board={board}
            refreshBoard={refreshBoard}
            isPreview={props.isPreview}
          ></KanbanLaneHeaderDisplay>
        )}
        renderCard={(card: KanbanCard, { dragging }: { dragging: boolean }) => {
          return (
            <KanbanCardDisplay
              card={card}
              board={board}
              refreshBoard={refreshBoard}
              isPreview={props.isPreview}
            ></KanbanCardDisplay>
          );
        }}
        allowAddLane={!props.isPreview}
        onNewLaneConfirm={(newLane: any) => {
          board.lanes.push({ id: Date.now(), ...newLane });
          refreshBoard(board);
        }}
        disableCardDrag={props.isPreview}
        disableLaneDrag={props.isPreview}
        onCardDragEnd={(
          card: KanbanCard,
          source: { fromPosition: number; fromLaneId: number },
          destination: { toPosition: number; toLaneId: number }
        ) => {
          const { fromPosition, fromLaneId } = source;
          let { toPosition, toLaneId } = destination;
          const fromLane = board.lanes.filter(l => l.id === fromLaneId)[0];
          const toLane = board.lanes.filter(l => l.id === toLaneId)[0];
          fromLane.cards.splice(fromPosition, 1);
          toLane.cards = [
            ...toLane.cards.slice(0, toPosition),
            card,
            ...toLane.cards.slice(toPosition, toLane.cards.length)
          ];

          refreshBoard(board);
        }}
        onLaneDragEnd={(
          source: { fromPosition: number },
          destination: { toPosition: number }
        ) => {
          const fromPosition: number = source.fromPosition;
          const toPosition: number = destination.toPosition;
          const fromLane = board.lanes[fromPosition];
          const toLane = board.lanes[toPosition];
          board.lanes[toPosition] = fromLane;
          board.lanes[fromPosition] = toLane;
          refreshBoard(board);
        }}
      >
        {board}
      </Board>
    </div>
  );
}

export const KanbanWidgetCreator: WidgetCreator = args => {
  const el = document.createElement("span");
  ReactDOM.render(<KanbanWidget {...args}></KanbanWidget>, el);
  return el;
};

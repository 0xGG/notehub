import { TreeView, TreeItem } from "@material-ui/lab";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import clsx from "clsx";
import React, { useState, useCallback, useEffect } from "react";
import { IconButton, Box, Typography } from "@material-ui/core";
import { ChevronRight, ChevronDown } from "mdi-material-ui";
import { CrossnoteContainer } from "../containers/crossnote";
import { useTranslation } from "react-i18next";
import { Directory, Notebook } from "../lib/crossnote";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    treeItemRoot: {
      paddingLeft: "4px",
      // color: theme.palette.text.secondary,
      "&:focus > $treeItemContent": {
        color: "#1a73e8",
        backgroundColor: "#e8f0fe" //theme.palette.primary.main
        // backgroundColor: `var(--tree-view-bg-color, ${theme.palette.grey[400]})`,
        // color: "var(--tree-view-color)"
      },
      "&:focus > $treeItemLabelIcon": {
        color: "#1a73e8"
      }
    },
    treeItemContent: {
      cursor: "default",
      color: theme.palette.text.primary,
      // paddingLeft: theme.spacing(1),
      // paddingRight: theme.spacing(1),
      userSelect: "none",
      fontWeight: theme.typography.fontWeightMedium,
      "$treeItemExpanded > &": {
        fontWeight: theme.typography.fontWeightRegular
      }
    },
    treeItemGroup: {
      marginLeft: 0,
      "& $treeItemContent": {
        // paddingLeft: theme.spacing(2)
      }
    },
    treeItemExpanded: {},
    treeItemLabel: {
      fontWeight: "inherit",
      color: "inherit"
    },
    treeItemLabelRoot: {
      display: "flex",
      alignItems: "center",
      padding: theme.spacing(1, 0)
    },
    treeItemLabelIcon: {
      color: "rgba(0, 0, 0, 0.54)"
    },
    treeItemLabelText: {
      paddingLeft: "12px",
      flexGrow: 1
    }
  })
);

interface Props {
  notebook: Notebook;
}
export default function NotebookTreeView(props: Props) {
  const classes = useStyles();
  const crossnoteContainer = CrossnoteContainer.useContainer();

  const [expanded, setExpanded] = useState<string[]>([]);
  const handleChange = useCallback(
    (event: React.ChangeEvent<{}>, nodes: string[]) => {
      event.stopPropagation();
      const element = event.target as HTMLElement;
      if (
        element &&
        element.tagName &&
        element.tagName.toUpperCase().match(/^(SVG|PATH|BUTTON)$/)
      ) {
        crossnoteContainer.setSelectedNotebook(props.notebook);
        setExpanded(nodes);
      }
    },
    [props.notebook]
  );

  const constructDirectoryTreeItems: (directory: Directory) => any = (
    directory: Directory
  ) => {
    if (directory.name === ".") {
      return (
        <>{directory.children.map(dir => constructDirectoryTreeItems(dir))}</>
      );
    } else {
      return (
        <TreeItem
          nodeId={directory.name}
          classes={{
            root: classes.treeItemRoot,
            content: classes.treeItemContent,
            expanded: classes.treeItemExpanded,
            group: classes.treeItemGroup,
            label: classes.treeItemLabel
          }}
          endIcon={<div style={{ width: 24 }}></div>}
          key={directory.name}
          label={
            <Box
              onClick={() => {
                crossnoteContainer.setSelectedDir(directory.path);
              }}
              className={clsx(classes.treeItemLabelRoot)}
            >
              <span role="img" aria-label="folder">
                {"📁"}
              </span>
              <Typography
                color={"inherit"}
                variant={"body1"}
                className={clsx(classes.treeItemLabelText)}
              >
                {directory.name}
              </Typography>
            </Box>
          }
        >
          {directory.children.map(dir => constructDirectoryTreeItems(dir))}
        </TreeItem>
      );
    }
  };

  useEffect(() => {
    if (crossnoteContainer.selectedNotebook !== props.notebook) {
      setExpanded([]);
    }
  }, [crossnoteContainer.selectedNotebook, props.notebook]);

  return (
    <TreeView
      defaultExpandIcon={
        <IconButton
          disableFocusRipple={true}
          disableRipple={true}
          size={"medium"}
        >
          <ChevronRight></ChevronRight>
        </IconButton>
      }
      defaultCollapseIcon={
        <IconButton
          disableFocusRipple={true}
          disableRipple={true}
          size={"medium"}
        >
          <ChevronDown></ChevronDown>
        </IconButton>
      }
      defaultEndIcon={<div style={{ width: 24 }} />}
      expanded={expanded}
      onNodeToggle={handleChange}
      style={{ width: "100%" }}
    >
      <TreeItem
        nodeId={"notes"}
        classes={{
          root: classes.treeItemRoot,
          content: classes.treeItemContent,
          expanded: classes.treeItemExpanded,
          group: classes.treeItemGroup,
          label: classes.treeItemLabel
        }}
        label={
          <Box
            onClick={() => {
              crossnoteContainer.setSelectedNotebook(props.notebook);
              crossnoteContainer.setSelectedDir("$notes");
            }}
            className={clsx(classes.treeItemLabelRoot)}
          >
            {/*
            <span role="img" aria-label="notes">
              📒
          </span>*/}
            <Typography
              color={"inherit"}
              variant={"body1"}
              className={clsx(classes.treeItemLabelText)}
            >
              {props.notebook.name}
            </Typography>
          </Box>
        }
      >
        <TreeItem
          nodeId={"today-notes"}
          classes={{
            root: classes.treeItemRoot,
            content: classes.treeItemContent,
            expanded: classes.treeItemExpanded,
            group: classes.treeItemGroup,
            label: classes.treeItemLabel
          }}
          label={
            <Box
              onClick={() => {
                crossnoteContainer.setSelectedDir("$today");
              }}
              className={clsx(classes.treeItemLabelRoot)}
            >
              <span role="img" aria-label="today-notes">
                🗓
              </span>
              <Typography className={clsx(classes.treeItemLabelText)}>
                {"today"}
              </Typography>
            </Box>
          }
        ></TreeItem>
        <TreeItem
          nodeId={"todo-notes"}
          classes={{
            root: classes.treeItemRoot,
            content: classes.treeItemContent,
            expanded: classes.treeItemExpanded,
            group: classes.treeItemGroup,
            label: classes.treeItemLabel
          }}
          label={
            <Box
              onClick={() => {
                crossnoteContainer.setSelectedDir("$todo");
              }}
              className={clsx(classes.treeItemLabelRoot)}
            >
              <span role="img" aria-label="todo-notes">
                ☑️
              </span>
              <Typography className={clsx(classes.treeItemLabelText)}>
                {"todo"}
              </Typography>
            </Box>
          }
        ></TreeItem>
        <TreeItem
          nodeId={"directories"}
          classes={{
            root: classes.treeItemRoot,
            content: classes.treeItemContent,
            expanded: classes.treeItemExpanded,
            group: classes.treeItemGroup,
            label: classes.treeItemLabel
          }}
          label={
            <Box
              onClick={() => {
                crossnoteContainer.setSelectedDir("$notes");
              }}
              className={clsx(classes.treeItemLabelRoot)}
            >
              <span role="img" aria-label="directories">
                🗂
              </span>
              <Typography className={clsx(classes.treeItemLabelText)}>
                {"notes"}
              </Typography>
            </Box>
          }
        >
          {constructDirectoryTreeItems(crossnoteContainer.notebookDirectories)}
        </TreeItem>
        <TreeItem
          nodeId={"tagged-notes"}
          classes={{
            root: classes.treeItemRoot,
            content: classes.treeItemContent,
            expanded: classes.treeItemExpanded,
            group: classes.treeItemGroup,
            label: classes.treeItemLabel
          }}
          label={
            <Box
              onClick={() => {
                crossnoteContainer.setSelectedDir("$tagged");
              }}
              className={clsx(classes.treeItemLabelRoot)}
            >
              <span role="img" aria-label="tagged-notes">
                🏷️
              </span>
              <Typography className={clsx(classes.treeItemLabelText)}>
                {"tagged"}
              </Typography>
            </Box>
          }
        ></TreeItem>
        <TreeItem
          nodeId={"untagged-notes"}
          classes={{
            root: classes.treeItemRoot,
            content: classes.treeItemContent,
            expanded: classes.treeItemExpanded,
            group: classes.treeItemGroup,
            label: classes.treeItemLabel
          }}
          label={
            <Box
              onClick={() => {
                crossnoteContainer.setSelectedDir("$untagged");
              }}
              className={clsx(classes.treeItemLabelRoot)}
            >
              <span role="img" aria-label="untagged-notes">
                🈚
              </span>
              <Typography className={clsx(classes.treeItemLabelText)}>
                {"untagged"}
              </Typography>
            </Box>
          }
        ></TreeItem>
      </TreeItem>
    </TreeView>
  );
}

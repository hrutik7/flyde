import { Tag } from "@blueprintjs/core";
import React from "react";
import { AddPartMenuFilter } from "../AddPartMenu";

export interface AddPartMenuResultsSummaryProps {
  filter: AddPartMenuFilter;
  onChangeFilter: (filters: AddPartMenuFilter) => void;
  query: string;
  onChangeQuery: (query: string) => void;
  resultsCount: number;
}

export const AddPartMenuResultsSummary: React.FC<
  AddPartMenuResultsSummaryProps
> = (props) => {
  const { resultsCount, query, filter, onChangeFilter, onChangeQuery } = props;

  function filterTag() {
    if (filter.type === "all") return null;
    if (filter.type === "external") {
      return (
        <>
          from &nbsp;<Tag
		  minimal
          interactive
          onRemove={() => onChangeFilter({ type: "all" })}
        >package {filter.module}
          {filter.namespace ? ` / ${filter.namespace}` : null}
        </Tag>
		</>
      );
    }
    return (
		<>from &nbsp;
      <Tag
	  	minimal
        interactive
        onRemove={() => onChangeFilter({ type: "all" })}
      >
		&nbsp;this project {filter.file ? ` / ${filter.file}` : null}
      </Tag>
	  </>
    );
  }

  return (
    <div className="add-part-menu-results-summary">
		{resultsCount ? `Showing ${resultsCount} result${resultsCount > 1 ? "s" : ""}` : "No results found"}
      &nbsp;
      {query ? (<>matching query&nbsp;
        <Tag minimal interactive onRemove={() => onChangeQuery("")}>
          "{query}"
        </Tag>
		</>
      ) : null}
      {filterTag()}
    </div>
  );
};

"use client";

import { useId, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

import { BUTTON_CLASSES } from "@/components/ui/button-classes";
import { CONTROL_CLASSES } from "@/components/ui/form-field";
import { MAX_LINKED_SKILLS } from "@/db/limits";
import { moveItem, type Direction } from "@/features/admin/ordering";
import type { SkillOption } from "@/features/catalog/skill-options";
import { SKILL_DOMAINS } from "@/features/content/vocabulary";

import { announce } from "../announce";
import { ADMIN_COPY } from "../copy";
import { useFieldList, useMarkEdited } from "./content-form";

const COPY = ADMIN_COPY.skillPicker;
const MOVE = ADMIN_COPY.content.move;

const ICON_BUTTON =
  "border-line text-fg-muted hover:text-fg hover:border-fg-muted rounded-control inline-flex size-9 items-center justify-center border aria-disabled:cursor-not-allowed aria-disabled:opacity-40";

interface PickedSkillProps {
  readonly skill: SkillOption;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly onMove: (direction: Direction) => void;
  readonly onRemove: () => void;
}

/** At an end, a button stays focusable but does nothing: focus is never dropped. */
function PickedSkill({
  skill,
  isFirst,
  isLast,
  onMove,
  onRemove,
}: PickedSkillProps) {
  const move = (
    direction: Direction,
    isEnd: boolean,
    label: string,
    icon: string,
  ) => (
    <button
      type="button"
      aria-disabled={isEnd ? true : undefined}
      onClick={() => {
        if (!isEnd) {
          onMove(direction);
        }
      }}
      className={ICON_BUTTON}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
  return (
    <li className="flex items-center gap-2 py-2">
      <span className="mr-auto text-sm font-medium">{skill.name}</span>
      {move("up", isFirst, MOVE.up(skill.name), "↑")}
      {move("down", isLast, MOVE.down(skill.name), "↓")}
      <button
        type="button"
        data-remove=""
        onClick={onRemove}
        className={ICON_BUTTON}
      >
        <span aria-hidden="true">✕</span>
        <span className="sr-only">{COPY.remove(skill.name)}</span>
      </button>
    </li>
  );
}

interface PickedListProps {
  readonly picked: readonly string[];
  readonly bySlug: ReadonlyMap<string, SkillOption>;
  readonly onMove: (slug: string, direction: Direction) => void;
  readonly onRemove: (slug: string) => void;
}

/** The linked skills, in order, each to move or remove. */
function PickedList({ picked, bySlug, onMove, onRemove }: PickedListProps) {
  if (picked.length === 0) {
    return <p className="text-fg-muted text-sm">{COPY.empty}</p>;
  }
  return (
    // role="list": Safari drops list semantics once list-style is none.
    <ol role="list" className="divide-line max-w-md divide-y">
      {picked.map((slug, index) => {
        const skill = bySlug.get(slug);
        return skill === undefined ? null : (
          <PickedSkill
            key={slug}
            skill={skill}
            isFirst={index === 0}
            isLast={index === picked.length - 1}
            onMove={(direction) => {
              onMove(slug, direction);
            }}
            onRemove={() => {
              onRemove(slug);
            }}
          />
        );
      })}
    </ol>
  );
}

interface SkillChooserProps {
  /** The skills not linked yet. */
  readonly left: readonly SkillOption[];
  readonly isFull: boolean;
  readonly chooserRef: RefObject<HTMLSelectElement | null>;
  /** The group's refusal, when the list sent was refused. */
  readonly errorId: string | undefined;
  readonly onAdd: (slug: string) => void;
}

/** A skill to add, from those left, by domain; or why none can be. */
function SkillChooser({
  left,
  isFull,
  chooserRef,
  errorId,
  onAdd,
}: SkillChooserProps) {
  const chooserId = useId();
  if (isFull || left.length === 0) {
    return (
      <p className="text-fg-muted text-sm">
        {isFull ? COPY.full(MAX_LINKED_SKILLS) : COPY.noneLeft}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={chooserId} className="text-sm font-medium">
          {COPY.choose}
        </label>
        <select
          ref={chooserRef}
          id={chooserId}
          aria-invalid={errorId === undefined ? undefined : true}
          aria-describedby={errorId}
          // Choosing is not changing: only an added skill counts as unsaved.
          onInput={(event) => {
            event.stopPropagation();
          }}
          className={CONTROL_CLASSES}
        >
          {SKILL_DOMAINS.map((domain) => {
            const options = left.filter((skill) => skill.domain === domain);
            return options.length === 0 ? null : (
              <optgroup key={domain} label={ADMIN_COPY.skills.domains[domain]}>
                {options.map((skill) => (
                  <option key={skill.slug} value={skill.slug}>
                    {skill.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>
      <button
        type="button"
        onClick={() => {
          onAdd(chooserRef.current?.value ?? "");
        }}
        className={BUTTON_CLASSES.secondary}
      >
        {COPY.add}
      </button>
    </div>
  );
}

interface PickedSkillsOptions {
  readonly initial: readonly string[];
  readonly bySlug: ReadonlyMap<string, SkillOption>;
  readonly groupRef: RefObject<HTMLFieldSetElement | null>;
  readonly chooserRef: RefObject<HTMLSelectElement | null>;
}

/**
 * The picked slugs and what changes them. Each change shows at once
 * (flushSync), so the focus can go into what it shows; it is said aloud, and
 * counts as unsaved.
 */
function usePickedSkills({
  initial,
  bySlug,
  groupRef,
  chooserRef,
}: PickedSkillsOptions) {
  const markEdited = useMarkEdited();
  const [picked, setPicked] = useState<readonly string[]>(() =>
    initial.filter((slug) => bySlug.has(slug)),
  );
  const nameOf = (slug: string) => bySlug.get(slug)?.name ?? slug;
  const change = (next: readonly string[], message: string) => {
    flushSync(() => {
      setPicked(next);
    });
    markEdited();
    announce(message);
  };
  const add = (slug: string) => {
    if (!bySlug.has(slug)) {
      return;
    }
    const next = [...picked, slug];
    change(next, COPY.added(nameOf(slug), next.length, next.length));
    // Nothing left to add, the chooser is gone: the new skill takes the focus.
    if (chooserRef.current === null) {
      groupRef.current
        ?.querySelector<HTMLElement>("li:last-child [data-remove]")
        ?.focus();
    }
  };
  const move = (slug: string, direction: Direction) => {
    const next = moveItem(picked, slug, direction);
    if (next === undefined) {
      return;
    }
    // React moves a row by inserting it again: the button pressed would lose the focus.
    const pressed = document.activeElement;
    change(next, COPY.moved(nameOf(slug), next.indexOf(slug) + 1, next.length));
    if (pressed instanceof HTMLElement && pressed !== document.activeElement) {
      pressed.focus();
    }
  };
  const remove = (slug: string) => {
    change(
      picked.filter((other) => other !== slug),
      COPY.removed(nameOf(slug)),
    );
    chooserRef.current?.focus();
  };
  return { picked, add, move, remove };
}

interface SkillPickerProps {
  /** Sent once per skill, in order. */
  readonly name: string;
  readonly skills: readonly SkillOption[];
  /** The linked skills' slugs, in order. */
  readonly initial: readonly string[];
}

/**
 * The skills an entry links, in the order its badges show: added from the
 * catalog, then moved or removed. Hidden fields carry the order.
 */
export function SkillPicker({ name, skills, initial }: SkillPickerProps) {
  const { values, problem } = useFieldList(name, initial);
  const bySlug = new Map(skills.map((skill) => [skill.slug, skill]));
  const groupRef = useRef<HTMLFieldSetElement>(null);
  const chooserRef = useRef<HTMLSelectElement>(null);
  const { picked, add, move, remove } = usePickedSkills({
    initial: values,
    bySlug,
    groupRef,
    chooserRef,
  });
  const hintId = useId();
  const errorId = useId();
  const error =
    problem === undefined ? undefined : COPY.invalid(MAX_LINKED_SKILLS);

  return (
    <fieldset
      ref={groupRef}
      aria-describedby={error === undefined ? hintId : `${hintId} ${errorId}`}
      className="flex min-w-0 flex-col gap-3"
    >
      <legend className="mb-4 text-lg font-semibold tracking-tight">
        {COPY.legend}
      </legend>
      <p id={hintId} className="text-fg-muted text-xs">
        {COPY.hint}
      </p>
      <PickedList
        picked={picked}
        bySlug={bySlug}
        onMove={move}
        onRemove={remove}
      />
      {picked.map((slug) => (
        <input key={slug} type="hidden" name={name} value={slug} />
      ))}
      <SkillChooser
        left={skills.filter((skill) => !picked.includes(skill.slug))}
        isFull={picked.length >= MAX_LINKED_SKILLS}
        chooserRef={chooserRef}
        errorId={error === undefined ? undefined : errorId}
        onAdd={add}
      />
      {error !== undefined && (
        <p id={errorId} className="text-danger text-sm font-medium">
          {error}
        </p>
      )}
    </fieldset>
  );
}

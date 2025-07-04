import type { Client } from "./client.ts";
import {
  type InitializationData,
  type Operation,
  ROOT,
  type TreeData,
  type TreeItemShareInfo,
  type TreeItemWithChildren,
} from "./schema.ts";
import { toJson, toOpml, toPlainText, toString } from "./export.ts";
import {
  createAccessToken,
  createSharedUrl,
  fromNativePermissionLevel,
  PermissionLevel,
  toNativePermissionLevel,
} from "./share.ts";

class Companion {
  private operations: Record<string, Operation[]> = {};
  private expansionsDelta: Map<string, boolean> = new Map();
  constructor(
    public readonly client: Client,
    public readonly itemMap: Map<string, TreeItemWithChildren>,
    public readonly shortIdMap = new Map<string, string>(),
    public readonly shareMap: Map<string, TreeItemShareInfo>,
    public readonly shareIdMap: Map<string, string>,
    public readonly expandedProjects: Set<string>,
    public readonly initializationData: InitializationData,
  ) {}

  public resolveId(id: string): string {
    return this.shortIdMap.has(id) ? this.shortIdMap.get(id)! : id;
  }

  public getPendingOperations() {
    return this.operations;
  }

  public getPendingExpansionsDelta() {
    return this.expansionsDelta;
  }

  public addOperation(treeId: string, operation: Operation): void {
    if (!this.operations[treeId]) {
      this.operations[treeId] = [];
    }
    this.operations[treeId].push(operation);
  }

  public addExpansionDelta(id: string, expanded: boolean) {
    this.expansionsDelta.set(id, expanded);
  }

  public isDirty() {
    return Object.keys(this.operations).length > 0 ||
      this.expansionsDelta.size > 0;
  }

  public async save(): Promise<void> {
    const ops = this.operations;
    this.operations = {}; // purge
    const expansionsDelta = Object.fromEntries(this.expansionsDelta);
    this.expansionsDelta = new Map(); // purge
    const operationResult = await this.client.pushAndPull(ops, expansionsDelta);

    const errorEncountered = operationResult.some((r) =>
      r.error_encountered_in_remote_operations
    );

    if (errorEncountered) {
      throw new Error("Error encountered in remote WorkFlowy operations");
    }
  }

  public getRealTimestamp(timestamp: number): Date {
    const u = timestamp +
      this.initializationData.mainProjectTreeInfo.dateJoinedTimestampInSeconds;
    return new Date(u * 1000);
  }

  public getNow(): number {
    const timeInSeconds = Math.floor(Date.now() / 1000);
    return timeInSeconds -
      this.initializationData.mainProjectTreeInfo.dateJoinedTimestampInSeconds;
  }
}

export class Document {
  #companion: Companion;
  /** Pointer to the root of the WorkFlowy */
  public readonly root: List;

  constructor(
    client: Client,
    data: TreeData,
    initializationData: InitializationData,
    sharedTrees: Record<string, TreeData> = {},
  ) {
    const itemMap = new Map<string, TreeItemWithChildren>();
    const shortIdMap = new Map<string, string>();

    const getItem = (id: string, treeId: string) => {
      if (itemMap.has(id)) {
        return itemMap.get(id)!;
      }
      const shortId = id.split("-").pop()!;
      shortIdMap.set(shortId, id);
      const newItem = {
        id,
        children: [],
        treeId,
      } as unknown as TreeItemWithChildren;
      itemMap.set(id, newItem);
      return newItem;
    };

    data.items.sort((a, b) => Math.sign(a.priority - b.priority));

    for (const item of data.items) {
      const p = getItem(item.parentId, ROOT);
      p.children.push(item.id);
      const t = getItem(item.id, ROOT);
      itemMap.set(item.id, { ...t, ...item });
    }

    itemMap.get(ROOT)!.name = "Home";

    const shareMap = new Map<string, TreeItemShareInfo>();

    for (const [id, shareInfo] of Object.entries(data.shared_projects)) {
      shareMap.set(id, shareInfo);
    }

    const expandedProjects: Set<string> = new Set<string>(data.server_expanded_projects_list as string[]);

    const shareIdMap = new Map<string, string>();

    for (const [shareId, sharedTree] of Object.entries(sharedTrees)) {
      sharedTree.items.sort((a, b) => Math.sign(a.priority - b.priority));

      for (const item of sharedTree.items) {
        if (item.parentId !== ROOT) {
          const p = getItem(item.parentId, shareId);
          p.children.push(item.id);
        } else {
          shareIdMap.set(shareId, item.id);
        }
        const t = getItem(item.id, shareId);
        itemMap.set(item.id, { ...t, ...item });
      }

      for (
        const [id, shareInfo] of Object.entries(sharedTree.shared_projects)
      ) {
        shareMap.set(id, shareInfo);
      }

      for (const id of sharedTree.server_expanded_projects_list) {
        expandedProjects.add(id);
      }
    }

    for (const [id, shareInfo] of shareMap) {
      shareIdMap.set(shareInfo.shareId, id);
    }

    this.#companion = new Companion(
      client,
      itemMap,
      shortIdMap,
      shareMap,
      shareIdMap,
      expandedProjects,
      initializationData,
    );
    this.root = this.getList(ROOT);
  }

  /** Lists in the root of WorkFlowy */
  public get items(): List[] {
    return this.root.items;
  }

  /**
   * Returns a List specified by ID or short ID. Make sure that the ID exists.
   * The short ID is the part of ID that is visible in Workflowy URLs.
   * @param id ID of the list to get
   * @returns A list instance with the particular ID
   */
  public getList(id: string) {
    const resolvedId = this.#companion.resolveId(id);
    return new List(resolvedId, this.#companion);
  }

  /** Returns a list of changes to be made to WorkFlowy when saving */
  public getPendingOperations(): Record<string, Operation[]> {
    return this.#companion.getPendingOperations();
  }

  /** Returns a map of list expansions changes to be made when saving*/
  public getPendingExpansionsDelta(): Map<string, boolean> {
    return this.#companion.getPendingExpansionsDelta();
  }

  /** Returns true if there are unsaved changes */
  public isDirty(): boolean {
    return this.#companion.isDirty();
  }

  /** Saves the document */
  public save(): Promise<void> {
    return this.#companion.save();
  }
}

/**
 * A list corresponds to a node in a WorkFlowy document
 */
export class List {
  #companion: Companion;

  constructor(
    public readonly id: string,
    companion: Companion,
  ) {
    this.#companion = companion;
  }

  private get source(): TreeItemWithChildren {
    return this.#companion.itemMap.get(this.id)!;
  }

  private get data(): TreeItemWithChildren {
    const source = this.source;
    if (source.isMirrorRoot) {
      return this.#companion.itemMap.get(source.originalId!)!;
    }
    if (source.shareId !== undefined) {
      const proxyId = this.#companion.shareIdMap.get(source.shareId);
      if (proxyId === undefined) {
        throw new Error(`Shared list not found: ${source.shareId}`);
      }
      return this.#companion.itemMap.get(proxyId!)!;
    }
    return source;
  }

  private get shareData(): TreeItemShareInfo {
    const id = this.data.id;
    if (!this.#companion.shareMap.has(id)) {
      this.#companion.shareMap.set(id, {
        shareId: "none",
        isSharedViaUrl: false,
        urlAccessToken: undefined,
        urlPermissionLevel: undefined,
        isSharedViaEmail: false,
      });
    }
    return this.#companion.shareMap.get(id)!;
  }

  private get idPrefix(): string {
    const id = this.data.id;
    const hyphenIndex = id.indexOf("-");
    return hyphenIndex === -1 ? id : id.slice(0, hyphenIndex);
  }

  /** List name */
  public get name(): string {
    return this.data.name;
  }

  /** List note */
  public get note(): string {
    return this.data.note || "";
  }

  /** Date of last change */
  public get lastModifiedAt(): Date {
    return this.#companion.getRealTimestamp(this.data.lastModified);
  }

  /** Date of completion, or undefined if not completed */
  public get completedAt(): Date | undefined {
    if (this.data.completed !== undefined) {
      return this.#companion.getRealTimestamp(this.data.completed);
    }
    return undefined;
  }

  /** True if completed, false otherwise */
  public get isCompleted(): boolean {
    return this.completedAt !== undefined;
  }

  /** True if the list is a mirror of another list */
  public get isMirror(): boolean {
    return this.source.isMirrorRoot;
  }

  /** True if the list is expanded */
  public get isExpanded(): boolean {
    return this.#companion.expandedProjects.has(this.idPrefix);
  }

  /** ID of mirrored list, if this list is a mirror; otherwise undefined */
  public get originalId(): string | undefined {
    return this.source.originalId;
  }

  /** Returns a parent list */
  public get parent(): List {
    return new List(this.source.parentId, this.#companion);
  }

  /** Returns a position of the list relative to its siblings within the parent */
  public get priority(): number {
    return this.parent.itemIds.indexOf(this.id);
  }

  /** Returns all items in this list */
  public get items(): List[] {
    return this.data.children.map((cId) => new List(cId, this.#companion));
  }

  /** Returns all item IDs in this list */
  public get itemIds(): string[] {
    return this.data.children;
  }

  /** True if the list is shared via URL */
  public get isSharedViaUrl(): boolean {
    return this.shareData.isSharedViaUrl;
  }

  /** True if the list is shared via email */
  public get isSharedViaEmail(): boolean {
    return this.shareData.isSharedViaEmail;
  }

  /** Returns shared URL or undefined if the list is not shared */
  public get sharedUrl(): string | undefined {
    if (this.isSharedViaUrl) {
      const key = this.shareData.urlAccessToken ?? this.shareData.shareId;
      return createSharedUrl(key);
    }
    return undefined;
  }

  /** Returns shared permission level of the list */
  public get sharedUrlPermissionLevel(): PermissionLevel {
    return fromNativePermissionLevel(this.shareData.urlPermissionLevel || 0);
  }

  /** Finds an item in this list and returns it, undefined if it does not find any */
  public findOne(
    namePattern: RegExp,
    descriptionPattern = /.*/,
  ): List | undefined {
    const results = this.findAll(namePattern, descriptionPattern);
    return results.length > 0 ? results[0] : undefined;
  }

  /** Finds all items in this list */
  public findAll(
    namePattern: RegExp,
    notePattern = /.*/,
  ): List[] {
    const results: List[] = [];
    for (const candidate of this.items) {
      const nameMatch = candidate.name.match(namePattern);
      const descriptionMatch = candidate.note.match(
        notePattern,
      );
      if (nameMatch && descriptionMatch) {
        results.push(candidate);
      }
    }
    return results;
  }

  /**
   * Creates a new sublist
   * @param priority position of the sublist within other sublists;
   * -1 appends the list to the end
   * @returns the new list
   */
  public createList(priority = -1): List {
    if (priority === -1) {
      priority = this.itemIds.length;
    }
    priority = Math.max(0, Math.min(priority, this.itemIds.length));

    const newId = crypto.randomUUID();

    this.#companion.itemMap.set(newId, {
      id: newId,
      name: "",
      note: undefined,
      parentId: this.id,
      priority: 0, // there is some special algo in WF
      completed: undefined,
      lastModified: this.#companion.getNow(),
      originalId: undefined,
      isMirrorRoot: false,
      shareId: undefined,
      children: [],
      treeId: this.data.treeId,
    });

    this.#companion.shortIdMap.set(newId.split("-").pop()!, newId);

    this.itemIds.splice(priority, 0, newId);

    const parentid = this.id === "home" ? ROOT : this.id;

    this.#companion.addOperation(this.data.treeId, {
      type: "create",
      data: {
        projectid: newId,
        parentid,
        priority,
      },
      undo_data: {},
    });

    return new List(newId, this.#companion);
  }

  /**
   * Alias for `.createList` in case if it feels weird to call an item a list :-)
   * @param priority position of the item within other items in the same parent;
   * -1 appends the item to the end
   * @returns the new item
   */
  public createItem(priority = -1): List {
    return this.createList(priority);
  }

  /**
   * Sets a new name
   * @returns {List} this
   */
  public setName(name: string): List {
    this.#companion.addOperation(this.data.treeId, {
      type: "edit",
      data: {
        projectid: this.data.id,
        name,
      },
      undo_data: {
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
        previous_name: this.name,
      },
    });
    this.data.name = name;
    return this;
  }

  /**
   * Sets a new note
   * @returns {List} this
   */
  public setNote(note: string): List {
    this.#companion.addOperation(this.data.treeId, {
      type: "edit",
      data: {
        projectid: this.data.id,
        description: note,
      },
      undo_data: {
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
        previous_description: this.data.note,
      },
    });
    this.data.note = note;
    return this;
  }

  /**
   * Completes the list
   * @returns {List} this
   */
  public setCompleted(complete = true): List {
    if (complete === this.isCompleted) {
      return this;
    }

    this.#companion.addOperation(this.data.treeId, {
      type: complete ? "complete" : "uncomplete",
      data: {
        projectid: this.data.id,
      },
      undo_data: {
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
        previous_completed: this.data.completed ?? false,
      },
    });

    this.data.completed = complete ? this.#companion.getNow() : undefined;
    return this;
  }

  /**
   * Moves this list to a different list
   *
   * @param {List} target New parent of the current list
   * @param {number} priority Position of this list in the new parent;
   * -1 appends the list to the end of the target list's children
   */
  public move(target: List, priority = -1) {
    if (priority === -1) {
      priority = target.itemIds.length;
    }
    priority = Math.max(0, Math.min(priority, target.itemIds.length));

    this.#companion.addOperation(this.data.treeId, {
      type: "move",
      data: {
        projectid: this.id,
        parentid: target.id,
        priority,
      },
      undo_data: {
        previous_parentid: this.parent.id,
        previous_priority: this.priority,
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
      },
    });

    this.parent.itemIds.splice(this.priority, 1);
    this.data.parentId = target.id;
    target.itemIds.splice(priority, 0, this.id);
  }

  /**
   * Deletes this list from WorkFlowy. Use with caution!
   */
  public delete() {
    this.#companion.addOperation(this.data.treeId, {
      type: "delete",
      data: {
        projectid: this.id,
      },
      undo_data: {
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
        parentid: this.parent.id,
        priority: this.priority,
      },
    });
    this.parent.itemIds.splice(this.priority, 1);
    this.#companion.itemMap.delete(this.id);
    this.#companion.shortIdMap.delete(this.id.split("-").pop()!);
  }

  /**
   * Enables sharing for the list and returns a shared URL
   *
   * @param permissionLevel Permission level - View, EditAndComment, or FullAccess
   * @returns Shared URL
   */
  public shareViaUrl(permissionLevel: PermissionLevel): string {
    if (
      permissionLevel !== PermissionLevel.View &&
      permissionLevel !== PermissionLevel.EditAndComment &&
      permissionLevel !== PermissionLevel.FullAccess
    ) {
      throw new Error(
        "Invalid permission level. Use PermissionLevel.View, PermissionLevel.EditAndComment, or PermissionLevel.FullAccess. To disable sharing use the unshare method.",
      );
    }

    if (
      this.isSharedViaUrl && this.sharedUrlPermissionLevel === permissionLevel
    ) {
      return this.sharedUrl!;
    }

    if (!this.isSharedViaUrl && !this.isSharedViaEmail) {
      this.#companion.addOperation(this.data.treeId, {
        type: "share",
        data: {
          projectid: this.id,
        },
        undo_data: {
          previous_last_modified: this.data.lastModified,
          previous_last_modified_by: null,
        },
      });
    }

    this.shareData.isSharedViaUrl = true;

    if (!this.shareData.urlAccessToken) {
      this.shareData.urlAccessToken = createAccessToken();
    }

    this.shareData.urlPermissionLevel = toNativePermissionLevel(
      permissionLevel,
    );

    this.#companion.addOperation(this.data.treeId, {
      type: "add_shared_url",
      data: {
        projectid: this.id,
        permission_level: this.shareData.urlPermissionLevel,
        access_token: this.shareData.urlAccessToken,
      },
      undo_data: {
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
        previous_permission_level: this.shareData.urlPermissionLevel, // This is weird, but WF does it so
      },
    });

    return this.sharedUrl!;
  }

  /**
   * Disables sharing via URL for the list
   */
  public unshareViaUrl() {
    if (!this.isSharedViaUrl) {
      return;
    }

    this.#companion.addOperation(this.data.treeId, {
      type: "remove_shared_url",
      data: {
        projectid: this.id,
      },
      undo_data: {
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
        permission_level: this.shareData.urlPermissionLevel!, // This is weird, but WF does it so
      },
    });

    this.shareData.isSharedViaUrl = false;
    this.shareData.urlAccessToken = undefined;
    this.shareData.urlPermissionLevel = undefined;

    if (this.isSharedViaEmail) {
      return;
    }

    this.#companion.addOperation(this.data.treeId, {
      type: "unshare",
      data: {
        projectid: this.id,
      },
      undo_data: {
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
      },
    });
  }

  /**
   * Expands the list
   */
  public expand(): void {
    if (!this.isExpanded) {
      this.#companion.expandedProjects.add(this.idPrefix);
      this.#companion.addExpansionDelta(this.idPrefix, true);
    }
  }

  /**
   * Collapses the list
   */
  public collapse(): void {
    if (this.isExpanded) {
      this.#companion.expandedProjects.delete(this.idPrefix);
      this.#companion.addExpansionDelta(this.idPrefix, false);
    }
  }

  /**
   * Prints the list and its content as a nice string
   *
   * @param omitHeader Whether to print only the content the current list
   * @returns {string} stringified list
   */
  public toString(omitHeader = false): string {
    return toString(this, omitHeader);
  }

  /**
   * Prints the list and its content in Plain Text format
   *
   * @returns {string} list in Plain Text format
   */
  public toPlainText(): string {
    return toPlainText(this);
  }

  /**
   * Prints the list and its content in JSON format
   *
   * @returns list in JSON format
   */
  // deno-lint-ignore no-explicit-any
  public toJson(): any {
    return toJson(this);
  }

  /**
   * Prints the list and its content in OPML format
   *
   * @returns list in OPML format
   */
  public toOpml(): string {
    return toOpml(this);
  }
}

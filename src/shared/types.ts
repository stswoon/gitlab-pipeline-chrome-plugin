export type Param = { key: string; value: string };

export type Profile = {
    id: string;
    name: string;
    params: Param[];
    bulkText?: string;
};

export type ProfileStorage = {
    profiles: Profile[];
    selectedProfileId: string | null;
};

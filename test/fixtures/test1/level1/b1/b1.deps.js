({
    shouldDeps: [
        {
            block: 'b1',
            mods: { m1: 'v1' }
        }
    ],
    noDeps: {
        block: 'b1',
        mods: { m1: ['v1', 'v2'] }
    }
})

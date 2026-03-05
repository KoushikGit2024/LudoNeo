const range =(start, end) => {
    const res = [];
    let i = start;
    while (true) {
        res.push(i);
        if (i === end) break;
        i = i+1;
    }
    return res;
}

const piecePath = {
    R: [...range(1, 56),72],
    B: [...range(14, 51),...range(0, 12),...range(57, 61),73],
    Y: [...range(27, 51),...range(0, 25),...range(62, 66),74],
    G: [...range(40, 51),...range(0, 38),...range(67, 71),75],
};

export  default piecePath;